let logChannelId
let logChannel

module.exports = {
    name: 'join-leave',
    synopsis: 'Log when users join or leave the server.',
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
        }

        client.on('guildMemberAdd', (member) => {
            logChannel.send(`<@${member.id}> joined the server.`)
        })

        client.on('guildMemberRemove', (member) => {
            logChannel.send(`<@${member.id}> left the server.`)
        })
    },
}
