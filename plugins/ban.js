const {DiscordAPIError} = require('discord.js')

module.exports = {
    name: 'ban',
    usage: 'who:user ...reason',
    synopsis: 'Ban a user from the server (silently).',
    description:
"Unlike Discord's normal ban feature, this has no option for deleting messages from the banee. The banee will not be notified they are banned; from their perspective the server will simply disappear.",
    async run({who, reason}, message) {
        try {
            await message.guild.bans.create(who, {reason})
            await message.reply(`I have banned ${who}.`)
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                await message.reply('I was unable to ban that user.')
            }
        }
    },
}
