const { Readable } = require("stream")
const Discord = require("discord.js")


module.exports = {
    name: 'raw',
    usage: 'raw <message id>',
    synopsis: 'DM the raw Discord markdown text that was written to make a message, then delete the command message.',
    description:
`Given the ID of a message in the same channel as the command, the bot provides the original Discord markdown text that was used to create the message via DM, then deletes the message that triggered the command.`,
    trigger: 'raw',

    async action({args, message, bot, plugin}) {
        const match = /^(?<messageId>[^ ]+)$/s.exec(args)

        if (match === null) {
            await message.reply(bot.formatUsage(plugin))
            return
        }

        const messageToProvide =
            await message.channel.messages.fetch(match.groups.messageId)
        const attachmentStream = Readable.from([messageToProvide.content])
        const attachment = new Discord.MessageAttachment(attachmentStream, 'attachment.md')
        await message.author.send({files: [attachment]})
        await message.delete()
    },
}
