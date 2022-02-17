module.exports = {
    name: 'ping',
    usage: 'ping',
    synopsis: 'Say "Pong!".',
    description:
'This command only replies back with a message. It can be used to see if the \
bot is responding.',
    trigger: 'ping',

    action: async ({message}) => {
        await message.reply('Pong!')
    },
}
