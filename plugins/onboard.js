const schedule = require('node-schedule')
const {info, fatal} = require('../log')

const BATCH_ADMISSION_CAP = 50

let onboardingCategoryIds
let admissionChannelId
let reminderChannelId
let reminderMessage
let memberRoleId
let patronRoleIds
let freezerRoleIds
let commandPrefix

const initialize = ({config}) => {
    ({
        onboardingCategoryIds,
        admissionChannelId,
        reminderChannelId,
        reminderMessage,
        memberRoleId,
        patronRoleIds,
        freezerRoleIds,
    } = config?.onboarding ?? {})
    commandPrefix = config.commandPrefix

    if (onboardingCategoryIds === undefined) {
        fatal(
`Please list out onboarding categories by editing the "onboardingCategoryIds" field under "onboarding".`
        )
    }

    if (admissionChannelId === undefined) {
        fatal(
`Please specify an admission logging channel by editing the "admissionChannelId" field under "onboarding".`
        )
    }

    if (reminderChannelId === undefined) {
        fatal(
`Please specify a reminder logging channel by editing the "reminderChannelId" field under "onboarding".`
        )
    }

    if (reminderMessage === undefined) {
        fatal(
`Please specify a reminder message by editing the "reminderMessage" field under "onboarding".`
        )
    }

    if (memberRoleId === undefined) {
        fatal(
`Please specify a member role by editing the "memberRoleId" field under "onboarding".`
        )
    }

    if (patronRoleIds === undefined) {
        fatal(
`Please list out patron roles by editing the "patronRoleIds" field under "onboarding".`
        )
    }

    if (freezerRoleIds === undefined) {
        fatal(
`Please list out freezer roles by editing the "freezerRoleIds" field under "onboarding".`
        )
    }
}

/*
const ready = ({guild}) => {
    const remind = async () => {
        const reminderChannel = guild.channels.resolve(reminderChannelId)
        await reminderChannel.send({
            content: reminderMessage,
            allowedMentions: {parse: ['roles', 'users']},
        })
    }

    schedule.scheduleJob({hour: 12, dayOfWeek: 1}, remind)
    schedule.scheduleJob({hour: 12, dayOfWeek: 4}, remind)
}
*/

const run = async ({
    view, admit, next, them, amount,
    kick, ban, freeze, who, reason, request
}, message) => {
    const guild = message.guild

    // Users are excluded from the listing if they're already in tickets,
    // so first we retrieve all the ticket channels.
    const ticketCategories = await Promise.all(
        onboardingCategoryIds.map((id) => guild.channels.fetch(id))
    )
    const ticketChannels = ticketCategories.flatMap(
        (category) => Array.from(category.children.cache.values())
    )

    // We're retrieving the users who will be let in next.
    if (next) {
        const queue = Array.from(
            guild.members.cache
            .filter(isNotBot)
            .filter(isNotMember)
            .filter(isNotInTicket(ticketChannels))
            .filter(isNotFrozen)
            .values()
        ).sort(byJoinDate)
        const queuedPatrons = queue.filter(isPatron)
        const queuedNonPatrons = queue.filter(isNotPatron)

        // Intersperse patrons and non-patrons.
        const selectedMembers = []
        let n = 0
        while (n < amount) {
            if (n % 2 == 0 && queuedPatrons.length > 0) {
                selectedMembers.push(queuedPatrons.shift())
            } else if (queuedNonPatrons.length > 0) {
                selectedMembers.push(queuedNonPatrons.shift())
            } else {
                break
            }

            n += 1
        }

        // Admit the retrieved users.
        if (admit) {
            if (amount > BATCH_ADMISSION_CAP) {
                message.reply(
                    `To avoid accidents, there is a cap of ${BATCH_ADMISSION_CAP} on how many users may be batch-admitted at once. Please request at most that many.`
                )
                return

            }
            await batchAdmit(message, selectedMembers)
        // View the retrieved users.
        } else if (view) {
            await outputMembers(message, selectedMembers)
        }
    // We're admitting the users pointed at by another message.
    } else if (them) {
        if (message.reference == null) {
            message.reply('Please reply to the message listing the users to admit.')
            return
        }
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId)
        selectedMembers = Array.from(repliedMessage.content.matchAll(/<@!?(?<id>\d+)>/g)).map((match) => guild.members.resolve(match.groups.id)).filter((member) => member != null)
        await batchAdmit(message, selectedMembers)
    // The remaining commands cannot be performed on full members.
    } else if (who.roles.cache.has(memberRoleId)) {
        await message.reply('I am unable to perform that operation on someone who is a full member of the server.')
    // We're permitting a user to enter.
    } else if (admit) {
        await admitMember(who, message, true)
    // The remaining commands require a reason to be given.
    } else if (reason !== undefined && reason.length === 0) {
        await message.reply('You must provide a non-empty reason.')
    // We're temporarily removing a user so they will go to the back of the queue if they rejoin.
    } else if (kick) {
        if (!who.kickable) {
            await message.reply('I am unable to kick that user.')
            return
        }

        try {
            await who.send('You have been removed from the Caves of Qud server onboarding queue. You may rejoin in order to requeue. The following reason was given:')
            await who.send(reason)
        } catch (_) {
            // Even if we can't DM the user, kick them anyway.
        }
        await message.reply(`⛔${who} has been kicked with this reason: ${reason}`)
        await who.kick(reason)
    // We're denying a user entry.
    } else if (ban) {
        if (!who.bannable) {
            await message.reply('I am unable to ban that user.')
            return
        }

        try {
            await who.send('You have been denied entry to the Caves of Qud server, with the following reason given:')
            await who.send(reason)
        } catch (_) {
            // Even if we can't DM the user, ban them anyway.
        }
        await message.reply(`⛔${who} has been **banned** with this reason: ${reason}`)
        await who.ban({reason})
    // A fallback case in case of programming mistakes.
    } else if (freeze) {
        if (isFrozen(who)) {
            message.reply('That user is already frozen.')
            return
        } else if (request.length === 0) {
            message.reply('You must give a request that will be DMed to the user.')
            return
        }

        // The first freezer role is the "main" one.
        await who.roles.add(freezerRoleIds[0])

        try {
            await who.send('The Caves of Qud Discord onboarding team has a request before you may enter. Once you have done it or if you have any questions, please DM a Mayor. Here is the request:')
            await who.send(request)
            message.reply('I have successfully frozen and DMed that user.')
        } catch (_) {
            message.reply('I was unable to DM that user. I have frozen them anyway.')
        }
    } else {
        await message.reply('Hmm, this message was supposed to be impossible.')
    }
}

const admitMember = async (member, message, direct) => {
    if (member.roles.cache.has(memberRoleId)) {
        await message.reply(`${member} is already a member.`)
        return
    }

    if (isFrozen(member)) {
        if (!direct) {
            await message.reply(`${member} is frozen in the queue. If you wish to admit anyway, use \`${commandPrefix}onboard admit ${member}\`.`)
            return
        } else {
            for (freezerRoleId of freezerRoleIds) {
                await member.roles.remove(freezerRoleId)
            }
        }
    }

    await member.roles.add(memberRoleId)
    const content = `🌈${member} has been granted access to the server.`

    if (direct) {
        message.reply(content)
    }

    const admissionChannel =
        await member.guild.channels.resolve(admissionChannelId)
    await admissionChannel.send(content)

    try {
        await member.send(
"You have been admitted to the Caves of Qud server. Please make sure you've reviewed https://discord.com/channels/214532333900922882/459836691822411786. See https://discord.com/channels/214532333900922882/735270006312402985 for additional useful information."
        )
    } catch (_) {
        info(`I was unable to DM ${member}.`)
    }
}

const batchAdmit = async (message, members) => {
    if (members.length > BATCH_ADMISSION_CAP) {
        message.reply(
            `To avoid accidents, there is a cap of ${BATCH_ADMISSION_CAP} on how many users may be batch-admitted at once. Please admit in smaller batches.`
        )
        return
    }

    await message.reply('Very well. Proceeding with admissions.')
    for (const member of members) {
        await admitMember(member, message)
    }
    await message.reply('I have admitted the requested batch.')
}

const outputMembers = async (message, members) => {
    let replyLines = []
    let count = 0
    let hasOutputAlready = false
    const MAX_ENTRIES_PER_MESSAGE = 10
    for (const member of members) {
        const patronText =
            isPatron(member) ? ' (Patron)'
          : /* otherwise */    ''
        const time = Math.floor(member.joinedTimestamp / 1000)
        replyLines.push(
`<@${member.id}>${patronText}, joined at <t:${time}:f> (<t:${time}:R>)`
        )
        count = (count + 1) % MAX_ENTRIES_PER_MESSAGE
        if (count === 0) {
            message.reply(replyLines.join('\n'))
            replyLines.length = 0
            hasOutputAlready = true
        }
    }

    if (replyLines.length !== 0) {
        message.reply(replyLines.join('\n'))
    } else if (hasOutputAlready) {
        // Do nothing. We've already listed some users.
    } else {
        message.reply('No results.')
    }
}

// Is the given member a non-bot account?
const isNotBot = (member) =>
    !member.user?.bot ?? true

// Does the given member lack the full member role?
const isNotMember = (member) =>
    !member.roles.cache.has(memberRoleId)

// Is the given member not already in a ticket? This means they can see one of
// the ticket channels.
const isNotInTicket = (ticketChannels) => (member) =>
    !ticketChannels.some((channel) =>
        channel.permissionsFor(member).has('ViewChannel'))

// Is the given member being held back in the airlock?
const isFrozen = (member) =>
    freezerRoleIds.some((freezerRoleId) => member.roles.cache.has(freezerRoleId))

const isNotFrozen = (member) => !isFrozen(member)

// Order the two given members by ascending join date. This is used with
// sorting functions expecting negative, zero, or positive based on an order.
const byJoinDate = (memberA, memberB) =>
    memberA.joinedTimestamp - memberB.joinedTimestamp

// Does the given member have a patron role?
const isPatron = (member) =>
    patronRoleIds.some((patronRoleId) => member.roles.cache.has(patronRoleId))

const isNotPatron = (member) =>
    !isPatron(member)

module.exports = {
    name: 'onboard',
    usage: [
        '"view" "next" amount:wholeNumber',
        '"admit" "next" amount:wholeNumber',
        '"admit" "them"',
        '"admit" who:member',
        '"kick" who:member ...reason',
        '"ban" who:member ...reason',
        '"freeze" who:member ...request'
    ],
    synopsis: 'Handle onboarding of new members.',
    description:
`This plugin is responsible for several different related functions:
- \`onboard view next\` shows the next \`amount\` users who will be let in.
- \`onboard admit next\` lets in the next \`amount\` users.
- \`onboard admit them\` lets in all users mentioned in the message you're replying to.
The following user-related commands only work on users who are not full members:
- \`onboard admit\` grants full entry to the server to the specified user.
- \`onboard kick\` kicks the user. The reason is required and will be DMed to them.
- \`onboard ban\` bans the user. The reason is required and will be DMed to them.
- \`onboard freeze\` freezes the user in the queue. This is for sending a user a request for them to follow before being admitted, such as changing their profile picture. They will also be DMed instructions on what to do, so just writing a request such as "please change your picture" is fine.
Whenever a user is admitted, they are also DMed to let them know.`,
    initialize,
    //ready,
    run,
}
