const {fatal} = require('../log')
let memberRoleId

module.exports = {
    name: 'airlockcount',
    usage: '',
    synopsis: 'Count how many users are in the airlock.',
    description:
"Airlock users are considered to be anyone who doesn't have the appropriate member role (configured in the bot's `\"memberRoleId\"` config field).",
    initialize(bot) {
        ({memberRoleId} = bot.config.onboarding ?? {})

        if (memberRoleId === undefined) {
            fatal(
`Please provide onboarding configuration by editing the "onboarding" field to be an object with the following field:
- "memberRoleId": a role snowflake – the role that represents server membership`
            )
        }
    },
    async run(_, message) {
        const guild = message.guild
        const memberRole = await guild.roles.fetch(memberRoleId)
        const count = guild.memberCount - memberRole.members.size
        message.reply(`There are ${count} users in the airlock.`)
    },
}
