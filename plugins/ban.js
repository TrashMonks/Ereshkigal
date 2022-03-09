module.exports = {
    name: 'ban',
    usage: 'ban <who to ban> <ban reason>',
    synopsis: 'Ban a user from the server (silently).',
    description:
"Unlike Discord's normal ban feature, this has no option for deleting messages from the banee. The banee will not be notified they are banned; from their perspective the server will simply disappear.",
    trigger: 'ban',

    action: async ({args, message, bot, plugin}) => {
        const match = /^(?<user>[^ ]+) (?<reason>.+)$/s.exec(args)

        if (match === null) {
            await message.reply(bot.formatUsage(plugin))
        } else {
            await message.guild.members.ban(match.groups.user,
                {reason: match.groups.reason})

            await message.reply('It is done.')
        }
    },
}
