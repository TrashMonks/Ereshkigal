const {setTimeout} = require('timers/promises')
const {Collection, DiscordAPIError} = require('discord.js')
const {fatal} = require('../log')

let applicationChannelId
let approvalChannelId
let approvedRoleId
let deniedRoleId
let memberRoleId
let patronRoleIds
let onboardingCategoryIds

const initialize = ({config}) => {
    ({
        applicationChannelId,
        approvalChannelId,
        approvedRoleId,
        deniedRoleId,
        memberRoleId,
        patronRoleIds,
        onboardingCategoryIds,
    } = config?.onboarding ?? {})

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

    if (onboardingCategoryIds === undefined) {
        fatal(
`Please list out onboarding categories by editing the "onboardingCategoryIds" field under "onboarding".`
        )
    }
}

const ready = ({client}) => {
    client.on('guildMemberUpdate', async (oldMember, member) => {
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
}

const run = async ({review, ticket, amount, admit, member}, message) => {
    if (review || ticket) {
        const guild = message.guild
        const applicationChannel = guild.channels.resolve(applicationChannelId)
        message.reply('Fetching all applications. Please wait.')
        const applications = await fetchAllMessages(applicationChannel)

        // The applicants map will associate each applicant with their latest
        // application.
        const applicants = new Map
        for (const [applicationId] of applications) {
            const application =
                await applicationChannel.messages.fetch(applicationId)
            const embed = application.embeds[0]
            // If there is no embed, it's not what we're looking for.
            if (embed === undefined) { continue }

            // This relies on the field containing the user's id having a
            // specific name. It could be un-hardcoded to some degree, but it
            // wouldn't help much since either way we're relying on an
            // unspecified observable feature of the applications. If something
            // suddenly and mysteriously breaks in the future, you know where
            // to look.
            const statsField = embed.fields.find(
                (field) => field.name === 'Application stats'
            ).value

            // Parse the applicant's user ID out of the field value.
            const match = /\*\*(?<id>\d+)\*\*/.exec(statsField)
            // Nothing to do if we didn't find the right text.
            if (match === null) { continue }

            const applicantId = match.groups.id

            // Check that they exist and are on the server.
            let applicant
            try {
                applicant = await guild.members.fetch(applicantId)
            // Fetching a user who's not on the server gives an API error.
            } catch (error) {
                if (error instanceof DiscordAPIError) {
                    continue
                } else {
                    throw error
                }
            }

            // Consider only the latest application from any applicant.
            const existingApplication = applicants.get(applicant)
            if (
                existingApplication === undefined ||
                existingApplication.createdTimestamp < application.createdTimestamp
            ) {
                applicants.set(applicant, application)
            }
        }

        let applicantsOfInterest
        if (review) {
            // We are interested in those who have submitted applications and
            // are not yet approved or denied.
            applicantsOfInterest = Array.from(applicants.keys())
                .filter(isAwaitingReview)
        } else if (ticket) {
            // First we need to find all the ticket channels because we need to
            // not return applicants who are in a ticket. This presumably means
            // they are already being onboarded.
            const onboardingCategories = await Promise.all(
                onboardingCategoryIds.map((id) => guild.channels.resolve(id))
            )
            const ticketChannels = onboardingCategories.flatMap((category) => {
                return Array.from(category.children.values())
            })

            // We are interested in those who are approved and not in a ticket.
            applicantsOfInterest = Array.from(applicants.keys())
                .filter(isApproved)
                .filter(isNotInTicket(ticketChannels))
        }
        // In case something weird happened, also ignore full members.
        applicantsOfInterest = applicantsOfInterest.filter(isNotMember)

        // Give priority to those who joined the server first (or, more
        // accurately, whose latest join to the server was first).
        applicantsOfInterest.sort(byJoinDate)

        // Now select some number of applicants to present.

        // Give a certain amount of priority to patrons. Try to find patrons
        // for half of the requested applicants, rounded up.
        const patronAmount = Math.ceil(amount / 2)
        const selectedPatrons = applicantsOfInterest
            .filter(isPatron)
            .slice(0, patronAmount)
        // Pad out the rest with any applicants not already selected.
        const selectedApplicants = selectedPatrons.concat(
            applicantsOfInterest.filter((applicant) =>
                !selectedPatrons.includes(applicant)
            ).slice(0, amount - selectedPatrons.length)
        )

        let replyLines = []
        let count = 0
        const MAX_APPLICANTS_PER_MESSAGE = 10
        for (const applicant of selectedApplicants) {
            const patronText =
                isPatron(applicant) ? ' (Patron)'
              : /* otherwise */       ''
            const applicationUrl =
                applicants.get(applicant)?.url ?? 'Somehow has no application.'
            replyLines.push(
`<@${applicant.id}>${patronText}: ${applicationUrl}`
            )
            count = (count + 1) % MAX_APPLICANTS_PER_MESSAGE
            if (count === 0) {
                message.reply(replyLines.join('\n'))
                replyLines.length = 0
            }
        }

        if (replyLines.length !== 0) {
            message.reply(replyLines.join('\n'))
        } else if (review) {
            message.reply('No one is awaiting review.')
        } else if (ticket) {
            message.reply('No one is awaiting a ticket.')
        }
    } else if (admit) {
        await member.roles.remove(approvedRoleId)
        await member.roles.add(memberRoleId)
        await message.reply(`${member} has been granted access to the server.`)
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
            (_) => ({keep: true}),
            (_) => ({keep: true}),
            (value, _) => ({keep: true, value}),
        )

        const last = nextMessages.last()
        if (last === undefined) { break }
        before = last.id
    }

    return messages
}

// Does the given member lack the full member role?
const isNotMember = (member) =>
    !member.roles.cache.has(memberRoleId)

// Is the given member awaiting review? This means they don't have the
// approved or denied roles.
const isAwaitingReview = (member) =>
    !member.roles.cache.has(approvedRoleId) &&
    !member.roles.cache.has(deniedRoleId)

const isApproved = (member) =>
    member.roles.cache.has(approvedRoleId)

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
        '"admit" member:member',
    ],
    synopsis: 'Handle onboarding of new members.',
    description:
`This plugin is responsible for five different related functions:
- When an applicant is approved for server entry, it sends notice of this to a channel.
- When an applicant is denied, it kicks them. Because priority is based on server join date, this effectively puts them at the end of the queue should they rejoin.
- The \`onboard review\` subcommand lists applications that have yet to be approved or denied. If able, it will ensure that at least half of them (rounded up) are patrons.
- The \`onboard ticket\` subcommand lists applications that have been approved but for which the applicant has yet to be admitted into the server. Like the \`review\` subcommand, it prioritizes patrons.
- The \`onboard admit\` subcommand grants full entry to the server to the specified user.`,
    initialize,
    ready,
    run,
}
