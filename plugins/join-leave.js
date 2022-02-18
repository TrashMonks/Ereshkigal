let logChannelId
let logChannel

module.exports = {
    name: 'join-leave',
    synopsis: 'Log when users join or leave the server.',
    description:
'Whenever a user joins or leaves the server, the bot posts a message in the \
logging channel (configured with the `"logChannelId"` config field) saying \
who joined or left, including a (silent) mention.',
    intents: ['GUILD_MEMBERS'],

    initialize(bot) {
        ({logChannelId} = bot.config ?? {})

        if (logChannelId === undefined) {
            bot.fatal(
'Please specify a logging channel by editing the "logChannelId" field.'
            )
        }
    },

    ready({client}) {
        logChannel = client.channels.resolve(logChannelId)

        if (logChannel === null) {
            bot.fatal(
'Could not resolve the log channel. Make sure it refers to an existing \
channel.'
            )

            return
        }

        client.on('guildMemberAdd', (member) => {
            logChannel.send(`<@${member.id}> joined the server.`)
        })

        client.on('guildMemberRemove', (member) => {
            logChannel.send(`<@${member.id}> left the server.`)
        })
    },
}
