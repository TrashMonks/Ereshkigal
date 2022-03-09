module.exports = {
    name: 'say',
    usage: 'say <content>',
    synopsis: 'Post some specified text.',
    description:
`Anything after the command word (minus the first space) is interpreted as the content of a message to be posted by the bot. The bot posts the message (as a non-reply) in the same channel as the command was invoked and then deletes the message that triggered the command. Any mentions will *not* go off; the mentioned user or role will still show as a mention, but they will not be highlighted or notified.
**Note:** The resulting message cannot be the full size of the Discord message limit because of the leading characters in the command trigger.`,
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
