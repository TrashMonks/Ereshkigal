const {setTimeout} = require('timers/promises')
const {Collection} = require('discord.js')
const {fatal} = require('../log')

let onboardingCategoryIds
let applicationChannelId
let approvalChannelId
let approvedRoleId
let deniedRoleId
let memberRoleId
let patronRoleIds

// A mapping from Discord user IDs onto message objects. This is updated
// immediately after connecting to the Discord API and then continuously as new
// messages come in in the application channel.
const userApplications = new Map

const initialize = ({config}) => {
    ({
        onboardingCategoryIds,
        applicationChannelId,
        approvalChannelId,
        approvedRoleId,
        deniedRoleId,
        memberRoleId,
        patronRoleIds,
    } = config?.onboarding ?? {})

    if (onboardingCategoryIds === undefined) {
        fatal(
`Please list out onboarding categories by editing the "onboardingCategoryIds" field under "onboarding".`
        )
    }

    if (applicationChannelId === undefined) {
        fatal(
`Please specify an application logging channel by editing the "applicationChannelId" field under "onboarding".`
        )
    }

    if (approvalChannelId === undefined) {
        fatal(
`Please specify an approval logging channel by editing the "approvalChannelId" field under "onboarding".`
        )
    }

    if (approvedRoleId === undefined) {
        fatal(
`Please specify an approved role by editing the "approvedRoleId" field under "onboarding".`
        )
    }

    if (deniedRoleId === undefined) {
        fatal(
`Please specify a denied role by editing the "deniedRoleId" field under "onboarding".`
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
}

const ready = async ({client, guild}) => {
    client.on('guildMemberUpdate', async (oldMember, member) => {
        // Ignore the addition of these roles to anyone already a member.
        if (member.roles.cache.has(memberRoleId)) { return }

        if (
            !oldMember.roles.cache.has(approvedRoleId) &&
            member.roles.cache.has(approvedRoleId)
        ) {
            // The user has been approved for membership.
            const approvalChannel =
            await client.channels.resolve(approvalChannelId)
            await approvalChannel.send(
`✅${member} has been approved for entry.`
            )
        } else if (
            !oldMember.roles.cache.has(deniedRoleId) &&
            member.roles.cache.has(deniedRoleId)
        ) {
            // The user has been denied for membership.
            if (member.kickable) {
                await setTimeout(1000)
                await member.kick('Entry application denied.')
            }
        }
    })

    // Cache all applications on startup and as they come in.
    client.on('messageCreate', (message) => {
        if (message.channel.id === applicationChannel.id) {
            processApplicationMessage(message)
        }
    })
    const applicationChannel = await guild.channels.fetch(applicationChannelId)
    for (const [_, message] of await fetchAllMessages(applicationChannel)) {
        processApplicationMessage(message)
    }
}

const processApplicationMessage = (message) => {
    const userId = computeUserIdFromMessage(message)
    if (userId === null) { return }

    // Consider only the latest application from any applicant.
    const existingApplication = userApplications.get(userId)
    if (
        existingApplication === undefined ||
        existingApplication.createdTimestamp < message.createdTimestamp
    ) {
        userApplications.set(userId, message)
    }
}

const computeUserIdFromMessage = (message) => {
    // NOTE: The logic to identify the user of each application relies on
    // unspecified observable features of the messages that the application bot
    // sends to represent the applications. If something suddenly and
    // mysteriously breaks in the future, you know where to look first.

    // First, check the message content for a mention with "'s" attached. This
    // is meant to disambiguate accepted or denied applications in which the
    // onboarder's mention may come first, but the applicant's mention is
    // phrased as a possessive.

    const possessiveMatch = /<@!?(?<id>\d+)>'s/.exec(message.content)

    if (possessiveMatch !== null) {
        return possessiveMatch.groups.id
    }

    // If that wasn't found, most likely it's fine to just search the message
    // and its embeds for a mention and assume that's the applicant.

    const mentionPattern = /<@!?(?<id>\d+)>/

    const messageMentionMatch = mentionPattern.exec(message.content)
    if (messageMentionMatch !== null) {
        return messageMentionMatch.groups.id
    }

    for (const embed of message.embeds) {
        for (const field of embed.fields) {
            const fieldMentionMatch = mentionPattern.exec(field.value)
            if (fieldMentionMatch !== null) {
                return fieldMentionMatch.groups.id
            }
        }
    }

    // Finally, if there was no mention whatsoever, it's most likely an older
    // application that contains only a username#discriminator in the message
    // content. Some of them may no longer be valid but we can try to match
    // up the ones that are still possible and flag the rest.

    const oldPattern = /\*\*(?<username>.*)\#(?<discriminator>.*)'s application/
    const oldMatch = oldPattern.exec(message.content)

    if (oldMatch !== null) {
        const username = oldMatch.groups.username
        const discriminator = oldMatch.groups.discriminator

        // Check the username-discriminator combo against all cached users.
        const result = message.guild.members.cache.filter((member) => {
            const user = member.user
            return user.username === username
                && user.discriminator === discriminator
        })?.first()?.id ?? null

        if (result === null) {
            console.warn('Missing user:', message.url)
        }

        return result
    }

    // That's it. At this point if the message hasn't met any of those tests,
    // it's probably not an application.

    console.warn('No apparent user:', message.url)
    return null
}

const run = async ({
    view, admit, next, grab, amount,
    app, approve, kick, ban, who, reason
}, message) => {
    const guild = message.guild

    // Users are excluded from the listing if they're already in tickets,
    // so first we retrieve all the ticket channels.
    const ticketCategories = await Promise.all(
        onboardingCategoryIds.map((id) => guild.channels.fetch(id))
    )
    const ticketChannels = ticketCategories.flatMap(
        (category) => Array.from(category.children.values())
    )

    // We're retrieving the users who will be let in next.
    if (next) {
        const approved = Array.from(
            (await guild.roles.fetch(approvedRoleId)).members
            .filter(isNotMember)
            .filter(isNotInTicket(ticketChannels))
            .values()
        ).sort(byJoinDate)
        const remainder = Array.from(
            guild.members.cache
            .filter(isNotMember)
            .filter(isNotInTicket(ticketChannels))
            .filter((member) => !approved.includes(member))
            .values()
        ).sort(byJoinDate)
        const queue = approved.concat(remainder)
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
            const AMOUNT_CAP = 50
            if (amount > AMOUNT_CAP) {
                message.reply(
                    `To avoid accidents, there is currently a cap of ${AMOUNT_CAP} on how many users may be batch-admitted at once. Please request at most that many.`
                )
                return
            }

            await message.reply('Very well. Proceeding with admissions.')
            for (const member of selectedMembers) {
                await admitMember(member)
            }
            await message.reply('I have admitted the requested batch.')
        // View the retrieved users.
        } else if (view) {
            await outputMembers(message, selectedMembers)
        }
    // We're fetching random applications.
    } else if (grab) {
        const users = Array.from(
            guild.members.cache
            .filter(isNotMember)
            .filter(isNotInTicket(ticketChannels))
            .filter(hasApplication)
            .filter((member) => !member.roles.cache.has(approvedRoleId))
            .values()
        )
        if (users.length <= amount) {
            await outputMembers(message, users)
            return
        }
        // This is crude but straightforward: Keep adding a random user to the
        // set until the set is as big as it needs to be. Because this
        // operation is not guaranteed to terminate, there is a step limit.
        const grabbedUsers = new Set
        const MAX_ATTEMPTS = amount * 100
        let attempts = 0
        while (grabbedUsers.size < amount && attempts < MAX_ATTEMPTS) {
            attempts += 1
            grabbedUsers.add(users[Math.floor(Math.random() * users.length)])
        }
        await outputMembers(message, Array.from(grabbedUsers.values()))
    // We're requesting the application for a user.
    } else if (app) {
        const applicationUrl =
            userApplications.get(who.id)?.url ?? 'No application found.'
        message.reply(applicationUrl)
    } else if ((admit || approve || kick || ban) && who.roles.cache.has(memberRoleId)) {
        await message.reply('I am unable to perform that operation on someone who is a full member of the server.')
    // We're permitting a user to enter.
    } else if (admit) {
        await admitMember(who)
        await message.reply(`🌈${who} has been granted access to the server.`)
    // We're moving a user up in the queue.
    } else if (approve) {
        if (who.roles.cache.has(approvedRoleId)) {
            await message.reply('That user is already approved.')
            return
        }
        await who.roles.add(approvedRoleId)
        try {
            await who.send("You've been moved up in the queue to join the Caves of Qud server. You will be DMed again when you're let in.")
        } catch (_) {
            // DMing failed.
        }
        await message.reply(`✅${who} has been approved for entry.`)
    } else if (reason !== undefined && reason.length === 0) {
        await message.reply('You must provide a non-empty reason.')
    // We're temporarily removing a user so they will go to the back of the queue.
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
    } else {
        await message.reply('Hmm, this message was supposed to be impossible.')
    }
}

// Fetch *every* message in the given channel. Because of limits designed into
// Discord's API, they must be fetched in chunks of 100, and there may be
// significant waiting time in between batches. All of this is handled by the
// discord.js package, but the function should still be used only when
// necessary and with the understanding that an immediate response will
// generally not be possible.
const fetchAllMessages = async (channel) => {
    let messages = new Collection([])
    let before

    while (true) {
        const nextMessages = await channel.messages.fetch({limit: 100, before})

        messages = messages.merge(
            nextMessages,
            (value) => ({keep: true, value}),
            (value) => ({keep: true, value}),
            (value, _) => ({keep: true, value}),
        )

        const last = nextMessages.last()
        if (last === undefined) { break }
        before = last.id
    }

    return messages
}

const admitMember = async (member) => {
    await member.roles.remove(approvedRoleId)
    await member.roles.add(memberRoleId)
    const content = `🌈${member} has been granted access to the server.`
    const approvalChannel =
        await member.guild.channels.resolve(approvalChannelId)
    await approvalChannel.send(content)

    try {
        await member.send('You have been admitted to the Caves of Qud server.')
    } catch (_) {
        console.log(`I was unable to DM ${member}.`)
    }
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
        const applicationUrl =
        userApplications.get(member.id)?.url ?? 'No application found.'
        const time = Math.floor(member.joinedTimestamp / 1000)
        replyLines.push(
`<@${member.id}>${patronText}, joined at <t:${time}:f> (<t:${time}:R>): ${applicationUrl}`
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

// Was an application found for the given member?
const hasApplication = (member) =>
    userApplications.has(member.id)

// Does the given member lack the full member role?
const isNotMember = (member) =>
    !member.roles.cache.has(memberRoleId)

// Is the given member not already in a ticket? This means they can see one of
// the ticket channels.
const isNotInTicket = (ticketChannels) => (member) =>
    !ticketChannels.some((channel) =>
        channel.permissionsFor(member).has('VIEW_CHANNEL'))

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
        '"grab" amount:wholeNumber',
        '"app" who:user',
        '"admit" who:member',
        '"approve" who:member',
        '"kick" who:member ...reason',
        '"ban" who:member ...reason',
    ],
    synopsis: 'Handle onboarding of new members.',
    description:
`This plugin is responsible for several different related functions:
- When a user is approved for server entry, it sends notice of this to a channel.
- When a user is denied, it kicks them. Because priority is based on server join date, this effectively puts them at the end of the queue should they rejoin.
- \`onboard view next\` shows the next \`amount\` users who will be let in.
- \`onboard admit next\` lets in the next \`amount\` users.
- \`onboard grab\` shows the applications of \`amount\` random users.
- \`onboard app\` retrieves the URL for the given user's application, if there is one.
The following user-related commands only work on users who are not full members:
- \`onboard admit\` grants full entry to the server to the specified user.
- \`onboard approve\` adds a user to the queue of users prioritized by the \`next\` commands.
- \`onboard kick\` kicks the user. The reason is required and will be DMed to them.
- \`onboard ban\` bans the user. The reason is required and will be DMed to them.
Whenever a user is admitted, they are also DMed to let them know.`,
    initialize,
    ready,
    run,
}
