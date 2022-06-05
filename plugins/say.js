module.exports = {
    name: 'say',
    usage: '...content',
    synopsis: 'Post some specified text.',
    description:
`Anything after the command word (minus the first space) is interpreted as the content of a message to be posted by the bot. The bot posts the message (as a non-reply) in the same channel as the command was invoked and then deletes the message that triggered the command.
**Note:** The resulting message cannot be the full size of the Discord message limit because of the leading characters in the command string.`,
    async run({content}, message) {
        await message.channel.send(content)
        await message.delete()
    },
}
