module.exports = {
    name: 'say',
    usage: 'say <content>',
    description: 'Post some specified text.',
    trigger: 'say',

    async action({args, message, bot, plugin}) {
        const match = /^(?<content>.+)$/s.exec(args)

        if (match === null) {
            await message.reply(bot.formatUsage(plugin))
            return
        }

        await message.channel.send(match.groups.content)
        await message.delete()
    },
}
