module.exports = {
    name: 'ban',
    usage: 'who:member ...reason',
    synopsis: 'Ban a user from the server (silently).',
    description:
"Unlike Discord's normal ban feature, this has no option for deleting messages from the banee. The banee will not be notified they are banned; from their perspective the server will simply disappear.",
    async run({who, reason}, message) {
        await message.guild.members.ban(who, {reason})

        await message.reply('It is done.')
    },
}
