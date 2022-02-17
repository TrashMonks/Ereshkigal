module.exports = {
    name: 'edit',
    usage: 'edit <message id> <new content>',
    synopsis: 'Edit a bot messsage, then delete the command message.',
    description:
'Given the ID of a message in the same channel as the command that was \
originally posted by the bot, the bot replaces its contents with the \
specified text and then deletes the message that triggered the command.\n\
Note: The resulting message cannot be the full size of the Discord message \
limit because of the leading characters in the command trigger.',
    trigger: 'edit',

    async action({args, message, bot, plugin} /* [messageId, ..._]*/) {
        const match = /^(?<messageId>[^ ]+) (?<newContent>.+)$/s.exec(args)

        if (match === null) {
            await message.reply(bot.formatUsage(plugin))
            return
        }

        const messageToEdit =
            await message.channel.messages.fetch(match.groups.messageId)

        await messageToEdit.edit(match.groups.newContent)
        await message.delete()
    },
}
