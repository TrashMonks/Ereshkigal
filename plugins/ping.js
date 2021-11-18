module.exports = {
    name: 'ping',
    usage: 'ping',
    description: 'Say "Pong!".',
    trigger: 'ping',

    action: async ({message}) => {
        await message.reply('Pong!')
    },
}
