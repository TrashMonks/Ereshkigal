const {fatal} = require('../log')
let memberRoleId
let patronRoleIds
let patronAccessRoleId

const initialize = ({config}) => {
    ({memberRoleId, patronRoleIds, patronAccessRoleId} = config?.onboarding ?? {})

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

    if (patronAccessRoleId === undefined) {
        fatal(
`Please specify a patron access role by editing the "patronAccessRoleId" field under "onboarding".`
        )
    }
}

const ready = async ({client, guild}) => {
    guild.members.cache.each(sync)
    client.on('guildMemberUpdate', async (_, member) => sync(member))
}

const sync = async (member) => {
    const eligible =
        member.roles.cache.has(memberRoleId) &&
        patronRoleIds.some((roleId) => member.roles.cache.has(roleId))
    const hasAccess = member.roles.cache.has(patronAccessRoleId)

    if (eligible && !hasAccess) {
        await member.roles.add(patronAccessRoleId)
    } else if (!eligible && hasAccess) {
        await member.roles.remove(patronAccessRoleId)
    }
}

module.exports = {
    name: 'patron-access',
    synopsis: 'Manage access to patron channels.',
    description:
"Access to the patron category requires that users have both the member role and one of the patron roles. Discord doesn't natively support this, so this plugin listens for role updates and gives the access role to users who satisfy these conditions and remove it from those who no longer do.",
    intents: ['GUILD_MEMBERS'],
    initialize,
    ready,
}
