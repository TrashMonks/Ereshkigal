let logChannelId
let logChannel

module.exports = {
    name: 'log-avatars',
    synopsis: 'Log when airlock users change their avatars.',
    description:
'Whenever an airlock user changes their avatar (profile picture), the bot posts a message in the logging channel (configured with the `"logChannelId"` config field) saying who it was and what their old and new avatars are. The new avatar is shown larger than the old.',
    intents: ['GUILD_MEMBERS'],

    initialize(bot) {
        ({logChannelId} = bot.config ?? {})

        if (logChannelId === undefined) {
            bot.fatal(
'Please specify a logging channel by editing the "logChannelId" field.'
            )
        }

        ({memberRoleId} = bot.config.onboarding ?? {})

        if (memberRoleId === undefined) {
            bot.fatal(
`Please provide onboarding configuration by editing the "onboarding" field to be an object with the following field:
- "memberRoleId": a role snowflake – the role that represents server membership`
            )
        }
    },

    ready(bot) {
        logChannel = bot.client.channels.resolve(logChannelId)

        if (logChannel === null) {
            bot.fatal(
'Could not resolve the log channel. Make sure it refers to an existing channel.'
            )
            return
        }

        bot.client.on('userUpdate', async (oldUser, newUser) => {
            const member = await logChannel.guild.members.fetch(newUser)

            if (member.roles.cache.has(bot.config.onboarding.memberRoleId)) {
                return
            }

            const oldAvatar = oldUser.displayAvatarURL({dynamic: true})
            const newAvatar = newUser.displayAvatarURL({dynamic: true})

            if (oldAvatar !== newAvatar) {
                logChannel.send({
                    content: `${newUser} changed avatar.`,

                    embeds: [
                        {
                            author: {
                                name: newUser.username + '#' + newUser.discriminator,
                                icon_url: newAvatar,
                            },

                            thumbnail: {url: oldAvatar},
                            image: {url: newAvatar},
                        },
                    ],
                })
            }
        })
    },
}
