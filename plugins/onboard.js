const {setTimeout} = require('timers/promises')
const {Collection, DiscordAPIError} = require('discord.js')
const {fatal} = require('../log')

let onboardingCategoryIds
let fridgeCategoryId
let applicationChannelId
let approvalChannelId
let airlockRoleIds
let approvedRoleId
let deniedRoleId
let memberRoleId
let patronRoleIds
let freezerRoleId

// A mapping from Discord user IDs onto message objects. This is updated
// immediately after connecting to the Discord API and then continuously as new
// messages come in in the application channel.
const userApplications = new Map

const initialize = ({config}) => {
    ({
        onboardingCategoryIds,
        fridgeCategoryId,
        applicationChannelId,
        approvalChannelId,
        airlockRoleIds,
        approvedRoleId,
        deniedRoleId,
        memberRoleId,
        patronRoleIds,
        freezerRoleId,
    } = config?.onboarding ?? {})

    if (onboardingCategoryIds === undefined) {
        fatal(
`Please list out onboarding categories by editing the "onboardingCategoryIds" field under "onboarding".`
        )
    }

    if (fridgeCategoryId === undefined) {
        fatal(
`Please specify a fridge category by editing the "fridgeCategoryId" field under "onboarding".`
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

    if (airlockRoleIds === undefined) {
        fatal(
`Please list out airlock roles by editing the "airlockRoleIds" field under "onboarding".`
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

    if (freezerRoleId === undefined) {
        fatal(
`Please specify a freezer role by editing the "freezerRoleId" field under "onboarding".`
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

    // A message in the application channel can be one of the following:
    // - an application with an embed
    // - an unaccepted application without an embed
    // - an accepted application without an embed
    // - not an application

    // We'll distinguish non-applications, or applications in an unknown format
    // (which are functionally the same thing) based on the presence or absence
    // of certain features assumed to be present on applications.

    // To determine which it is, first we need to know if there's an embed.
    const embed = message.embeds[0]

    // If there's no embed, it could be because the fields were too long for
    // the application bot to use an embed, so it's an attachment instead. The
    // user ID doesn't appear on this kind, but at least the username and
    // discriminator combo do, so we can still find the user.
    if (embed === undefined) {
        const unacceptedPattern =
/\*\*(?<username>.*)\#(?<discriminator>.*)'s application/
        const unacceptedMatch = unacceptedPattern.exec(message.content)

        // If that didn't match, it's still possible it's an accepted app.
        if (unacceptedMatch === null) {
            const acceptedPattern = /<@(?<id>\d+)>'s application/
            const acceptedMatch = acceptedPattern.exec(message.content)
            if (acceptedMatch === null) { return null }
            return acceptedMatch.groups.id
        }

        const username = unacceptedMatch.groups.username
        const discriminator = unacceptedMatch.groups.discriminator

        // Check the username-discriminator combo against all cached users.
        return message.guild.members.cache.filter((member) => {
            const user = member.user
            return user.username === username
                && user.discriminator === discriminator
        })?.first()?.id ?? null

    // If there's an embed, the user ID should show up in one of the fields.
    } else {
        // The field is named "Application stats". It must be an exact match!
        const statsField = embed.fields.find(
            (field) => field.name === 'Application stats'
        ).value

        // Parse the applicant's user ID out of the field value.
        const match = /\*\*(?<id>\d+)\*\*/.exec(statsField)

        return match?.groups.id ?? null
    }
}

const run = async (args, message) => {
    // We have to name args instead of just destructuring it, because we need
    // to check a property whose name is a reserved word, "new".
    const {
        review, ticket, amount,
        app, fridge, freeze, admit, kick, ban, who, channel, reason
    } = args

    const rolesToFetch = review          ? airlockRoleIds
                       : ticket          ? [approvedRoleId]
                       : args['new']     ? [approvedRoleId]
                       : /* otherwise */   null
    const guild = message.guild

    // We're listing out users in one of the queues.
    if (rolesToFetch !== null) {
        // Users are excluded from the listing if they're already in tickets,
        // so first we retrieve all the ticket channels.
        const ticketCategories = await Promise.all(
            onboardingCategoryIds.map((id) => guild.channels.fetch(id))
        )
        ticketCategories.push(await guild.channels.fetch(fridgeCategoryId))
        const ticketChannels = ticketCategories.flatMap(
            (category) => Array.from(category.children.values())
        )

        // Now we can retrieve all the users of the role we're asking for.
        let applicants = (await Promise.all(
            rolesToFetch.map((roleId) => guild.roles.fetch(roleId))
        )).flatMap((role) => Array.from(role.members.values()))

        // When reviewing applications, the users in question must have
        // submitted an application.
        if (review) {
            applicants = applicants.filter(hasApplication)
        }

        applicants = applicants
            // Normally, all users with these roles shouldn't be members, but in
            // case something weird happens, go ahead and filter them out.
            .filter(isNotMember)
            // Exclude anyone in a ticket.
            .filter(isNotInTicket(ticketChannels))
            // Sort by how long they've been on the server.
            .sort(byJoinDate)

        // Now select some number of applicants to present.

        // Give a certain amount of priority to patrons. Try to find patrons
        // for half of the requested applicants, rounded up.
        const patronAmount = Math.ceil(amount / 2)
        const selectedPatrons = applicants
            .filter(isPatron)
            .slice(0, patronAmount)
        // Pad out the rest with any applicants not already selected.
        const selectedApplicants = selectedPatrons.concat(
            applicants.filter((applicant) =>
                !selectedPatrons.includes(applicant)
            ).slice(0, amount - selectedPatrons.length)
        )

        if (args['new']) {
            if (selectedApplicants.length === 0) {
                message.reply('No one is awaiting a ticket.')
            }
            for (const applicant of selectedApplicants) {
                message.reply(`$new ${applicant.id}`)
            }
            return
        }

        let replyLines = []
        let count = 0
        let hasOutputAlready = false
        const MAX_APPLICANTS_PER_MESSAGE = 10
        for (const applicant of selectedApplicants) {
            const patronText =
                isPatron(applicant) ? ' (Patron)'
              : /* otherwise */       ''
            const applicationUrl =
            userApplications.get(applicant.id)?.url ?? 'No application found.'
            const time = Math.floor(applicant.joinedTimestamp / 1000)
            replyLines.push(
`<@${applicant.id}>${patronText}, joined at <t:${time}:f> (<t:${time}:R>): ${applicationUrl}`
            )
            count = (count + 1) % MAX_APPLICANTS_PER_MESSAGE
            if (count === 0) {
                message.reply(replyLines.join('\n'))
                replyLines.length = 0
                hasOutputAlready = true
            }
        }

        if (replyLines.length !== 0) {
            message.reply(replyLines.join('\n'))
        } else if (hasOutputAlready) {
            // Do nothing. We've already listed some applicants.
        } else if (review) {
            message.reply('No one is awaiting review.')
        } else if (ticket) {
            message.reply('No one is awaiting a ticket.')
        }
    // We're requesting the application for a user.
    } else if (app) {
        const applicationUrl =
            userApplications.get(who.id)?.url ?? 'No application found.'
        message.reply(applicationUrl)
    // We're sending a ticket to or retrieving a ticket from the fridge.
    } else if (fridge) {
        const fridgeCategory = await guild.channels.fetch(fridgeCategoryId)
        // The channel is fridged. Unfridge it.
        if (channel.parent.id === fridgeCategoryId) {
            const ticketCategories = await Promise.all(
                onboardingCategoryIds.map((id) => guild.channels.fetch(id))
            )
            await channel.setParent(ticketCategories[0]) // TODO
            await message.reply('I have taken that channel out of the fridge.')
        // The channel is unfridged. Fridge it.
        } else if (onboardingCategoryIds.some((id) => channel.parent.id === id)) {
            await channel.setParent(fridgeCategory, {lockPermissions: false})
            await message.reply('I have put that channel in the fridge.')
        // The channel is not a fridgable channel.
        } else {
            await message.reply("That isn't in a ticket category.")
        }
    } else if ((admit || freeze || kick || ban) && who.roles.cache.has(memberRoleId)) {
        await message.reply('I am unable to perform that operation on someone who is a full member of the server.')
    // We're freezing or unfreezing an onboardee.
    } else if (freeze) {
        if (who.roles.cache.has(freezerRoleId)) {
            await who.roles.remove(freezerRoleId)
            await message.reply(`I have removed the freezer role from ${who}.`)
        } else {
            await who.roles.add(freezerRoleId)
            await message.reply(`I have added the freezer role to ${who}.`)
        }
    // We're permitting a user to enter.
    } else if (admit) {
        await who.roles.remove(approvedRoleId)
        await who.roles.remove(freezerRoleId)
        for (airlockRoleId of airlockRoleIds) {
            await who.roles.remove(airlockRoleId)
        }
        await who.roles.add(memberRoleId)
        const content = `🌈${who} has been granted access to the server.`
        await message.reply(content)
        const approvalChannel =
            await guild.channels.resolve(approvalChannelId)
        await approvalChannel.send(content)
    // We're temporarily removing a user so they will go to the back of the queue.
    } else if (reason !== undefined && reason.length === 0) {
        await message.reply('You must provide a non-empty reason.')
    } else if (kick) {
        if (!who.kickable) {
            await message.reply('I am unable to kick that user.')
            return
        }

        await who.send('You have been removed from the Caves of Qud server onboarding queue. You may rejoin in order to requeue. The following reason was given:')
        await who.send(reason)
        await message.reply(`⛔${who} has been kicked with this reason: ${reason}`)
        await who.kick(reason)
    // We're denying a user entry.
    } else if (ban) {
        if (!who.bannable) {
            await message.reply('I am unable to ban that user.')
            return
        }

        await who.send('You have been denied entry to the Caves of Qud server, with the following reason given:')
        await who.send(reason)
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

module.exports = {
    name: 'onboard',
    usage: [
        '"review" amount:wholeNumber',
        '"ticket" amount:wholeNumber',
        '"new" amount:wholeNumber',
        '"app" who:user',
        '"fridge" channel:channel',
        '"freeze" who:member',
        '"admit" who:member',
        '"kick" who:member ...reason',
        '"ban" who:member ...reason',
    ],
    synopsis: 'Handle onboarding of new members.',
    description:
`This plugin is responsible for several different related functions:
- When an applicant is approved for server entry, it sends notice of this to a channel.
- When an applicant is denied, it kicks them. Because priority is based on server join date, this effectively puts them at the end of the queue should they rejoin.
- The \`onboard review\` subcommand lists applications that have yet to be approved or denied. If able, it will ensure that at least half of them (rounded up) are patrons.
- \`onboard ticket\` lists applications that have been approved but for which the applicant has yet to be admitted into the server. Like the \`review\` subcommand, it prioritizes patrons.
- \`onboard new\` works the same as \`onboard ticket\`, except it outputs the commands to get Ticket Tool to open tickets for the users.
- \`onboard app\` retrieves the URL for the given user's application, if there is one.
- \`onboard fridge\` moves a ticket channel to or from the fridge category, which is for tickets that are on hold but it's expected they may respond at some point.
The following commands only work on users who are not full members.
- \`onboard freeze\` adds or removes the freezer role on a user, which is for users who've been nonresponsive for a long time. It's expected that they will open their own tickets when they're ready.
- \`onboard admit\` grants full entry to the server to the specified user.
- \`onboard kick\` kicks the user. The reason is required and will be DMed to them.
- \`onboard ban\` bans the user. The reason is required and will be DMed to them.`,
    initialize,
    ready,
    run,
}
