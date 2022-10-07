const {setTimeout} = require('timers/promises')
const {Collection, DiscordAPIError} = require('discord.js')
const {fatal} = require('../log')

let onboardingCategoryIds
let applicationChannelId
let approvalChannelId
let airlockRoleIds
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
        airlockRoleIds,
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

const run = async ({
    review, ticket, amount,
    app, admit, deny, member
}, message) => {
    const rolesToFetch = review          ? airlockRoleIds
                       : ticket          ? [approvedRoleId]
                       : /* otherwise */   null
    const guild = message.guild

    // We're listing out users in one of the queues.
    if (rolesToFetch !== null) {
        // Users are excluded from the listing if they're already in tickets,
        // so first we retrieve all the ticket channels.
        const ticketChannels = (await Promise.all(
            onboardingCategoryIds.map((id) => guild.channels.fetch(id))
        )).flatMap((category) => Array.from(category.children.values()))

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
            userApplications.get(member.id)?.url ?? 'No application found.'
        message.reply(applicationUrl)
    } else if ((admit || deny) && member.roles.cache.has(memberRoleId)) {
        await message.reply('I am unable to admit or deny someone who is a full member of the server.')
    // We're permitting a user to enter.
    } else if (admit) {
        await member.roles.remove(approvedRoleId)
        await member.roles.add(memberRoleId)
        const content = `🌈${member} has been granted access to the server.`
        await message.reply(content)
        const approvalChannel =
            await guild.channels.resolve(approvalChannelId)
        await approvalChannel.send(content)
    // We're denying a user entry.
    } else if (deny) {
        await member.roles.add(deniedRoleId)
        await message.reply(`⛔${member} has been denied entry.`)
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
        '"app" member:member',
        '"admit" member:member',
        '"deny" member:member',
    ],
    synopsis: 'Handle onboarding of new members.',
    description:
`This plugin is responsible for several different related functions:
- When an applicant is approved for server entry, it sends notice of this to a channel.
- When an applicant is denied, it kicks them. Because priority is based on server join date, this effectively puts them at the end of the queue should they rejoin.
- The \`onboard review\` subcommand lists applications that have yet to be approved or denied. If able, it will ensure that at least half of them (rounded up) are patrons.
- The \`onboard ticket\` subcommand lists applications that have been approved but for which the applicant has yet to be admitted into the server. Like the \`review\` subcommand, it prioritizes patrons.
- The \`onboard app\` subcommand retrieves the URL for the given user's application, if there is one.
The following commands only work on users who are not full members.
- The \`onboard admit\` subcommand grants full entry to the server to the specified user.
- The \`onboard deny\` subcommand denies entry to the specified user, kicking them as mentioned above.`,
    initialize,
    ready,
    run,
}
