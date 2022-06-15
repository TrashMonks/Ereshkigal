const fetch = require('../fetch')

module.exports = {
    name: 'post',
    usage: [
        'channel:channel',
        'channel:channel ...content',
    ],
    synopsis: 'Send a message.',
    description:
`Post the given content in the given channel.
If the content isn't specified as part of the command text, it's taken from an attachment instead. Make sure there is exactly one attachment and that it's a text file.`,
    async run({channel, content}, message) {
        if (content === undefined) {
            if (message.attachments.size !== 1) {
                message.reply('Please attach precisely one attachment.')
                return
            }

            const attachment = message.attachments.first()
            const attachedContent = await fetch(attachment.url)

            if (attachedContent.length > 2000) {
                await message.reply('The attached content must not exceed the Discord message length limit of 2000 characters.')
            } else {
                await channel.send(attachedContent)
            }
        } else {
            await channel.send(content)
        }
    },
}
