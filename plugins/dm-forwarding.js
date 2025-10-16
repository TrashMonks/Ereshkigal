const {fatal} = require('../log')

let dmChannelId
let dmChannel

const initialize = async ({config}) => {
    void ({dmChannelId} = config ?? {})

    if (dmChannelId === undefined) {
        fatal(
'Please specify a DM forwarding channel by editing the "dmChannelId" field.'
        )
    }
}

const ready = async ({client, guild}) => {
    dmChannel = client.channels.resolve(dmChannelId)

    if (dmChannel === null) {
        fatal(
'Could not resolve the DM forwarding channel. Make sure it refers to an existing channel.'
        )
        return
    }

    client.on('messageCreate', async (message) => {
        if (message.guild === null) {
            const fromTo = message.author.id === client.user.id ? 'to' : 'from'
            const text = `DM ${fromTo} ${message.channel.recipient}:`
            console.log(`${text} ${message}`)
            if (message.author.id !== client.user.id) {
                dmChannel.send(text)
                message.forward(dmChannel)
            }
        }
    })
}

module.exports = {
    name: 'dm-forwarding',
    synopsis: 'Forward any DMs the bot receives to a designated channel.',
    description:
"The bot will mention the user who sent the DM and then forward the message that was received.",
    initialize,
    ready,
}
