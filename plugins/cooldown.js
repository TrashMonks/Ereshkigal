module.exports = {
    name: 'cooldown',
    usage: [
        'channel:channel',
        'channel:channel newCooldown:wholeNumber'
    ],
    synopsis: "Get or set a channel's per-user message cooldown.",
    description:
`This command can be used to set a channel cooldown to any whole number of seconds and give a precise number for any channel whose cooldown has been set this way, neither of which the Discord UI allows on its own.
Invoking without a new cooldown reports the current cooldown. Invoking with a new cooldown sets the cooldown.`,
    async run({channel, newCooldown}, message) {
        if (newCooldown === undefined) {
            await message.reply(
`<#${channel.id}>'s rate limit is ${channel.rateLimitPerUser}.`
            )
        } else {
            await channel.setRateLimitPerUser(newCooldown)
            await message.reply('Okay, cooldown set.')
        }
    },
}
