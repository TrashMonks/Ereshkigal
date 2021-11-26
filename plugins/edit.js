module.exports = {
    name: 'edit',
    usage: 'edit <message id> <new content>',
    description: 'Edit a bot messsage, then delete the command message.',
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
