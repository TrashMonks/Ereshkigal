module.exports = {
    name: 'edit',
    usage: 'message:message ...newContent',
    synopsis: 'Edit a bot messsage.',
    description:
`Given the ID or URI of a message that was originally posted by the bot, the bot replaces its contents with the specified text.
**Note:** The resulting message cannot be the full size of the Discord message limit because of the leading characters in the command string.`,
    async run({message, newContent}) {
        await message.edit(newContent)
    },
}
