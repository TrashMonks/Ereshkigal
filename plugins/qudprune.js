let memberRoleId

module.exports = {
    name: 'qudprune',
    usage: 'qudprune',
    description: 'List how many users are in the airlock.',

    initialize(bot) {
        ({memberRoleId} = bot.config.onboarding ?? {})

        if (memberRoleId === undefined) {
            bot.fatal(
'Please provide onboarding configuration by editing the "onboarding" field to \
be an object with the following field:\n\
- "memberRoleId": a role snowflakes – the role that represents server membership'
            )
        }
    },

    trigger: 'qudprune',

    async action({message}) {
        const count = message.guild.members.cache.filter((user) =>
            !user.roles.cache.has(memberRoleId)
        ).size

        message.reply(`There are ${count} users in the airlock.`)
    },
}
