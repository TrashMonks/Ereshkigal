const {Readable} = require("stream")
const {MessageAttachment} = require("discord.js")

module.exports = {
    name: 'raw',
    usage: 'raw <message uri>',
    synopsis:
'Show the raw formatting of a message.',
    description:
'Given a message URI, provide as an attachment the raw Discord formatting that was used to create the message.',
    trigger: 'raw',

    async action({args, message, bot, plugin}) {
        const match = /^https:\/\/discord.com\/channels\/(?<guildId>\d+)\/(?<channelId>\d+)\/(?<messageId>\d+)$/s.exec(args)

        if (match === null) {
            await message.reply(bot.formatUsage(plugin))
            return
        }

        const channelId = match.groups.channelId
        const messageId = match.groups.messageId
        const channel = message.guild.channels.resolve(channelId)
        const messageToProvide = await channel?.messages.fetch(messageId)
        const attachmentStream = Readable.from([messageToProvide.content])
        const attachment = new MessageAttachment(attachmentStream, `raw-${messageId}.txt`)
        await message.reply({files: [attachment]})
    },
}
