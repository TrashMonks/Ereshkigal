module.exports = {
    name: 'help',
    usage: ['help', 'help <topic>'],
    synopsis: "Query information about the bot's plugins.",
    trigger: /^help$|^help (?<topic>.*)/,

    action: async ({args, bot, message}) => {
        if (args.groups.topic === undefined) {
            const replyContent = ['The following plugins are installed. Pass a plugin name to this command for more information on it.']

            for (const plugin of bot.plugins) {
                replyContent.push(`${plugin.name}: ${plugin.synopsis}`)
            }

            await message.reply(replyContent.join('\n'))
        } else {
            const plugin = bot.plugins.find((plugin) =>
                args.groups.topic === plugin.name)

            if (plugin === undefined) {
                await message.reply(
`I was unable to find help on that topic. Try just \
\`${bot.config.commandPrefix}help\`.`
                )
            } else {
                await message.reply(
`${plugin.name}: ${plugin.synopsis}\n\
${bot.formatUsage(plugin)}`
                )
            }
        }
    },
}
