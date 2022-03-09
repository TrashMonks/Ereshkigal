module.exports = {
    name: 'hello',
    usage: 'hello',
    synopsis: 'Send a greeting.',
    description:
'This command can be used to see if the bot is responding or just for fun.',
    trigger: 'hello',

    action: async ({message}) => {
        await message.reply(`Hello. I am ${message.guild.me.displayName}.`)
    },
}
