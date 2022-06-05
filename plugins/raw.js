const {Readable} = require("stream")
const {MessageAttachment} = require("discord.js")

module.exports = {
    name: 'raw',
    usage: 'messageToFetch:message',
    synopsis:
'Show the raw formatting of a message.',
    description:
'Given a message ID or URI, provide as an attachment the raw Discord formatting that was used to create the message.',
    async run({messageToFetch}, message) {
        const attachmentStream = Readable.from([messageToFetch.content])
        const attachment = new MessageAttachment(attachmentStream, `raw-${messageToFetch.id}.txt`)
        await message.reply({files: [attachment]})
    },
}
