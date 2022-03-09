let memberRoleId

module.exports = {
    name: 'airlockcount',
    usage: 'airlockcount',
    synopsis: 'Count how many users are in the airlock.',
    description:
"Airlock users are considered to be anyone who doesn't have the appropriate member role (configured in the bot's `\"memberRoleId\"` config field).",

    initialize(bot) {
        ({memberRoleId} = bot.config.onboarding ?? {})

        if (memberRoleId === undefined) {
            bot.fatal(
`Please provide onboarding configuration by editing the "onboarding" field to be an object with the following field:
- "memberRoleId": a role snowflake – the role that represents server membership`
            )
        }
    },

    trigger: 'airlockcount',

    async action({message}) {
        const count = message.guild.members.cache.filter((user) =>
            !user.roles.cache.has(memberRoleId)
        ).size

        message.reply(`There are ${count} users in the airlock.`)
    },
}
