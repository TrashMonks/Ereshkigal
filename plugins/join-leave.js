const {fatal} = require('../log')
let logChannelId
let logChannel

module.exports = {
    name: 'join-leave',
    synopsis: 'Log when users join or leave the server.',
    description:
'Whenever a user joins or leaves the server, the bot posts a message in the logging channel (configured with the `"logChannelId"` config field) saying who joined or left, including a (silent) mention.',
    intents: ['GUILD_MEMBERS'],

    initialize(bot) {
        ({logChannelId} = bot.config ?? {})

        if (logChannelId === undefined) {
            fatal(
'Please specify a logging channel by editing the "logChannelId" field.'
            )
        }
    },

    ready({client}) {
        logChannel = client.channels.resolve(logChannelId)

        if (logChannel === null) {
            fatal(
'Could not resolve the log channel. Make sure it refers to an existing \
channel.'
            )
            return
        }

        client.on('guildMemberAdd', (member) => {
            const user = member.user

            logChannel.send({
                content: `${member} joined the server.`,
                embeds: [{
                    author: {
                        name: user.username + '#' + user.discriminator,
                        icon_url: member.displayAvatarURL({dynamic: true}),
                    },

                    thumbnail: {
                        url: member.displayAvatarURL({dynamic: true}),
                    },

                    color: 65280,

                    fields: [
                        {
                            name: 'Joined at',
                            value:
`<t:${Math.floor(member.joinedTimestamp / 1000)}>`,
                        },

                        {
                            name: 'Created at',
                            value:
`<t:${Math.floor(user.createdTimestamp / 1000)}>`,
                        }
                    ]
                }],
            })
        })

        client.on('guildMemberRemove', (member) => {
            logChannel.send({
                content:
`${member} (${member.displayName} / ${member.user.username}#${member.user.discriminator}) left the server :<`,
            })
        })
    },
}
