let logChannelId
let logChannel

module.exports = {
    name: 'log-avatars',
    synopsis: 'Log when users change their avatars.',
    description:
'Whenever a user changes their avatar (profile picture), the bot posts a \
message in the logging channel (configured with the `"logChannelId"` config \
field) saying who it was and what their old and new avatars are.',
    intents: ['GUILD_MEMBERS'],

    initialize(bot) {
        ({logChannelId} = bot.config ?? {})

        if (logChannelId === undefined) {
            bot.fatal(
'Please specify a logging channel by editing the "logChannelId" field.'
            )
        }
    },

    ready(bot) {
        logChannel = bot.client.channels.resolve(logChannelId)

        if (logChannel === null) {
            bot.fatal(
'Could not resolve the log channel. Make sure it refers to an existing \
channel.'
            )
        }

        bot.client.on('userUpdate', async (oldUser, newUser) => {
            const oldAvatar = oldUser.displayAvatarURL()
            const newAvatar = newUser.displayAvatarURL()

            if (oldAvatar !== newAvatar) {
                logChannel.send({
                    content: `${newUser} changed avatar.`,

                    embeds: [
                        {
                            description: 'Old avatar:',

                            image: {
                                url: oldAvatar,
                                width: 512, height: 512,
                            },
                        },

                        {
                            description: 'New avatar:',

                            image: {
                                url: newAvatar,
                                width: 512, height: 512,
                            },
                        }
                    ],

                    allowed_mentions: {parse: []}
                })
            }
        })
    },
}
