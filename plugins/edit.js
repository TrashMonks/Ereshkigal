const fetch = require('../fetch')

const run = async ({messageToEdit, newContent, messageToCopy}, message) => {
    if (!messageToEdit.editable) {
        message.reply('I am unable to edit that message.')
        return
    }

    // Content is from another message.
    if (messageToCopy !== undefined) {
        await messageToEdit.edit(messageToCopy.content)
    // Content is from the command message.
    } else if (newContent !== undefined) {
        await messageToEdit.edit(newContent)
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
            await messageToEdit.edit(attachedContent)
        }
    }

    await message.reply(`${messageToEdit.url} has been edited.`)
}

module.exports = {
    name: 'edit',
    usage: [
        'messageToEdit:message',
        'messageToEdit:message "to" "match" messageToCopy:message',
        'messageToEdit:message "text" ...newContent',
    ],
    synopsis: 'Edit a bot messsage.',
    description:
`Given a message that was originally posted by the bot, the bot replaces its content with the specified text.
The first form, with no arguments besides the message, takes the content from an attached file. Make sure there is exactly one attachment and that it's a text file.
The second form, introduced with the words \`to match\`, takes the content from another specified message.
The third form, introduced with the word \`text\`, takes the content from the message that triggered the command. (**Note:** Although the bot itself doesn't ping any users mentioned in the command output, you will still end up pinging them in the message to run the command if you use this form.)`,
    run,
}
