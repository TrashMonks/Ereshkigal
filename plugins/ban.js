module.exports = {
    name: 'ban',
    usage: 'ban <who to ban> <ban reason>',
    synopsis: 'Ban a user from the server (silently).',
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
