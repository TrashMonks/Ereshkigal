const run = async ({messageToPin}, message) => {
    if (message.channel.id !== messageToPin.channel.id) {
        await message.reply('This command must be run in the same channel as the message to be pinned or unpinned.')
        return
    }

    if (messageToPin.pinned) {
        messageToPin.unpin()
    } else {
        messageToPin.pin()
    }
}

module.exports = {
    name: 'pin',
    usage: 'messageToPin:message',
    synopsis: 'Pin or unpin a message in this channel.',
    description:
"If the given message isn't pinned, pin it. Otherwise unpin it. As a means of limiting scope, the command fails if run in a different channel from the to be pinned message.",
    run,
}
