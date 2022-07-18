module.exports = {
    name: 'say',
    usage: '...content',
    synopsis: 'Speak as the bot.',
    description:
`Post the given content in the same channel as the command was run and then delete the command message.
**Note:** The resulting message cannot be the full size of the Discord message limit because of the leading characters in the command message.
**Note:** Although the bot itself doesn't ping any users mentioned in the command output, you will still end up pinging them in the message to run the command. See \`post\` for an alternative.`,
    async run({content}, message) {
        await message.channel.send(content)
        await message.delete()
    },
}
