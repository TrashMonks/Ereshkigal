module.exports = {
    name: 'hello',
    usage: '',
    synopsis: 'Send a greeting.',
    description:
'This command can be used to see if the bot is responding or just for fun.',
    async run(_, message) {
        await message.reply(`Hello. I am ${message.guild.me.displayName}.`)
    },
}
