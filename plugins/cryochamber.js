const PIN_LIMIT = 50
const channels = new Map

const initialize = ({config}) => {
    void ({cryochamber: entries} = config ?? {})

    if (entries === undefined) {
        fatal('Please specify cryochamber preservation targets by editing the "cryochamber" field.')
    }

    for (const {from, to} of entries) {
        channels.set(from, to)
    }
}

const ready = ({client}) => {
    client.on('channelPinsUpdate', async (channel) => {
        const toId = channels.get(channel.id)
        if (toId === undefined) { return }
        const pinned = await channel.messages.fetchPinned()
        if (pinned.size < PIN_LIMIT) { return }
        const lastPin = pinned.last()
        const toChannel = await channel.guild.channels.fetch(toId)
        await lastPin.forward(toChannel)
        await lastPin.unpin()
    })
}

module.exports = {
    name: 'cryochamber',
    synopsis: "Automatically cycle out pins from configured channels, sending them to configured other channels.",
    description: 'Each channel may be associated with up to one other channel. When the source channel hits the pin limit, the bot will unpin the least recent pin, forwarding it to the destination channel.',
    initialize,
    ready,
}
