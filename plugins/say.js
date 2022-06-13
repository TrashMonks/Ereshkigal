module.exports = {
    name: 'say',
    usage: '...content',
    synopsis: 'Speak as the bot.',
    description:
`Post the given content in the same channel as the command was run and then delete the command message.
**Note:** The resulting message cannot be the full size of the Discord message limit because of the leading characters in the command message.`,
    async run({content}, message) {
        await message.channel.send(content)
        await message.delete()
    },
}
