module.exports = {
    name: 'id',
    usage: '...username',
    synopsis: "Get a server member's ID based on their username.",
    description:
`If the username contains a \`#\` character, it is interpreted as the combination of a username and a discriminator, i.e., the four-digit number that distinguishes users with identical usernames from each other.

Both parts, separately, are matched exactly. However, if no discriminator is given, then all users with the given name will be given.`,
    async run({username}, message) {
        const [username_, discriminator] = username.split('#')

        const results = message.guild.members.cache.filter((member) => {
            const user = member.user

            if (
                discriminator !== undefined &&
                user.discriminator !== discriminator
            ) {
                return false
            }

            return user.username === username_
        })

        const replyText = Array.from(results).map((e) => e[0]).join('\n')
        await message.reply(replyText.length === 0 ? 'No results.' : replyText)
    },
}
