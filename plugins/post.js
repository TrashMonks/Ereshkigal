const fetch = require('../fetch')

const allowedMentions = {parse: []}

const run = async ({channel, content, messageToCopy}, message) => {
    // Content is from another message.
    if (messageToCopy !== undefined) {
        await channel.send({
            content: messageToCopy.content,
            allowedMentions,
        })
    // Content is from the command message.
    } else if (content !== undefined) {
        await channel.send({
            content,
            allowedMentions,
        })
    // Content is from an attachment.
    } else {
        if (message.attachments.size !== 1) {
            message.reply('Please attach precisely one attachment.')
            return
        }

        const attachment = message.attachments.first()
        const attachedContent = await fetch(attachment.url)

        if (attachedContent.length > 2000) {
            await message.reply('The attached content must not exceed the Discord message length limit of 2000 characters.')
        } else {
            await channel.send({
                content: attachedContent,
                allowedMentions,
            })
        }
    }
}

module.exports = {
    name: 'post',
    usage: [
        'channel:channel',
        'messageToCopy:message "to" channel:channel',
        'channel:channel "text" ...content',
    ],
    synopsis: 'Send a message.',
    description:
`Post the given content in the given channel.
The first form, with no arguments besides the message, takes the content from an attached file. Make sure there is exactly one attachment and that it's a text file.
The second form, taking a message, the word \`to\`, and a channel, takes the content from a specified message.
The third form, introduced with the word \`text\`, takes the content from the message that triggered the command. (**Note:** Although the bot itself doesn't ping any users mentioned in the command output, you will still end up pinging them in the message to run the command if you use this form.)`,
    run,
}
