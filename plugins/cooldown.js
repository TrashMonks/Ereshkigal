module.exports = {
    name: 'cooldown',
    usage: [
        'cooldown <channel id>',
        'cooldown <channel id> <new cooldown in seconds>'
    ],
    synopsis: "Get or set a channel's per-user message cooldown.",
    description:
`This command can be used to set a channel cooldown to any whole number of seconds and give a precise number for any channel whose cooldown has been set this way, neither of which the Discord UI allows on its own.
Invoking without a new cooldown reports the current cooldown. Invoking with a new cooldown sets the cooldown.`,
    trigger: 'cooldown',

    action: async ({args, message, bot, plugin}) => {
        const match = /^(?<channelId>[^ ]+)( (?<newCooldown>\d+))?$/s.exec(args)

        if (match === null) {
            await message.reply(bot.formatUsage(plugin))
            return
        }

        const channel = message.guild.channels.resolve(match.groups.channelId)

        if (match.groups.newCooldown === undefined) {
            await message.reply(`<#${channel.id}>'s rate limit is ${channel.rateLimitPerUser}.`)
        } else {
            await channel.setRateLimitPerUser(Number(match.groups.newCooldown))
            await message.reply('Okay, cooldown set.')
        }
    },
}
