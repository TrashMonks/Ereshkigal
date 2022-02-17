module.exports = {
    name: 'ping',
    usage: 'ping',
    synopsis: 'Say "Pong!".',
    trigger: 'ping',

    action: async ({message}) => {
        await message.reply('Pong!')
    },
}
