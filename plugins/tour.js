const {fatal} = require('../log')

let approvalChannelId
let approvedRoleId
let deniedRoleId
let memberRoleId
let patronRoleIds

const initialize = ({config}) => {
    ({
        approvalChannelId,
        approvedRoleId,
        deniedRoleId,
        memberRoleId,
        patronRoleIds,
    } = config?.onboarding ?? {})

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
            // TODO: Send a DM?
            await member.kick('Entry application denied.')
        }
    })
}

const isPatron = (member) =>
    patronRoleIds.some((patronRoleId) => member.roles.cache.has(patronRoleId))

const byJoinDate = (memberA, memberB) =>
    memberA.joinedTimestamp - memberB.joinedTimestamp

const run = async ({next, done, member}, message) => {
    if (next) {
        const approvedRole = await message.guild.roles.fetch(approvedRoleId)

        // Select up to ten users from the full list. Try to select up to five
        // patrons first, then pad out the rest with either patrons or
        // non-patrons.

        const nextPatrons = Array.from(
            approvedRole.members.filter(isPatron).values()
        ).sort(byJoinDate).slice(0, 5)

        const next = nextPatrons.concat(
            Array.from(approvedRole.members.filter(
                (member) => !isPatron(member) && !nextPatrons.includes(member)
            ).values()).sort(byJoinDate).slice(0, 10 - nextPatrons.length)
        )

        if (next.length === 0) {
            message.reply('No one is waiting to be toured.')
        } else {
            message.reply(
`Next up for touring:
${next.join('\n')}`
            )
        }
    } else if (done) {
        await member.roles.remove(approvedRoleId)
        await member.roles.add(memberRoleId)
        await message.reply('Okay, all set.')
    } else {
        await message.reply('Hmm, this message was supposed to be impossible.')
    }
}

module.exports = {
    name: 'tour',
    usage: [
        '"next"',
        '"done" member:member'
    ],
    synopsis: 'Handle touring of new members.',
    description:
`This plugin is responsible for four different related functions:
- When an applicant is approved for server entry, it sends notice of this to a channel.
- When an applicant is denied, it kicks them. Because priority is based on server join date, this effectively puts them at the end of the queue should they rejoin.
- The \`tour next\` subcommand lists who is up next for touring. It lists up to ten users, preferring half of them to be patrons if able.
- The \`tour done\` subcommand grants full entry to the server.`,
    initialize,
    ready,
    run,
}
