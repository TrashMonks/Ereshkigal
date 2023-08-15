module.exports = {
    name: 'help',
    synopsis: 'Query information about enabled plugins.',
    usage: [
        '',
        'pluginName:string'
    ],
    description:
`This command provides usage information on enabled plugins. Run the command with no argument to see a complete list of all enabled plugins. Any of the bolded names can be passed as an argument to this command to find out more information about it.
When a plugin's name is passed (e.g., just like was done to trigger this message), that plugin's name, synopsis, and usage (if applicable) as well as a detailed description are given. The usage is a list of one or more ways to trigger the command. As with this help command, the command string must be sent as a message in a place where the bot can see.`,
    async run({pluginName}, message, bot) {
        if (pluginName === undefined) {
            const allowedSet = new Set(bot.permissions.getAllowed({
                roles: Array.from(message.member.roles.cache.keys()),
                channel: message.channel.id,
            }))
            const commandSynopses = []
            const otherSynopses = []

            for (const [_, plugin] of bot.plugins) {
                if (allowedSet !== '*' && !allowedSet.has(plugin.name)) {
                    continue
                }

                const category =
                    plugin.usage === undefined ? otherSynopses
                    /* otherwise */            : commandSynopses

                category.push(`**${plugin.name}** – ${plugin.synopsis}`)
            }

            await message.reply(
`The following plugins are enabled${
    allowedSet === '*' ? ''
    /* otherwise */    : ' and usable by you'
}. Run \`${bot.config.commandPrefix}help help\` for more information.

__Command Plugins__
${commandSynopses.join('\n') || '(None)'}

__Other Plugins__
${otherSynopses.join('\n') || '(None)'}`
            )
        } else {
            const plugin = bot.plugins.get(pluginName)

            if (plugin === undefined) {
                await message.reply(
`I was unable to find help on that topic. Try just \
\`${bot.config.commandPrefix}help\`.`
                )
            } else {
                await message.reply(
`**${plugin.name}** – ${plugin.synopsis}
${bot.formatUsage(plugin)}`
                )
                if (typeof plugin.description === 'string') {
                    await message.reply(plugin.description)
                }
            }
        }
    },
}
