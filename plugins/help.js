module.exports = {
    name: 'help',
    usage: ['help', 'help <plugin name>'],
    synopsis: "Query information about the bot's plugins.",
    description:
"Invoking without arguments lists the name and synopsis of every installed \
plugin.\n\
Invoking with the name of a plugin gives the name, synopsis, usage (if \
applicable), and detailed description for that plugin.",
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
${bot.formatUsage(plugin)}${
    typeof plugin.description === 'string'  ? '\n' + plugin.description
    /* otherwise */                         : ''
}`
                )
            }
        }
    },
}
