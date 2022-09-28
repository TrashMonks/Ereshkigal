const parsers = {
    /* basic types */

    integer(string) {
        const result = Number.parseInt(string, 10)
        return Number.isNaN(result) ? null
             : /* otherwise */        result
    },

    wholeNumber(string) {
        const integer = parsers.integer(string)
        return integer !== null && integer >= 0 ? integer
             : /* otherwise */                    null
    },

    string(string) {
        return string
    },

    /* Discord types */

    async channel(string, message) {
        if (string === 'here') { return message.channel }
        const match =
/^https:\/\/discord.com\/channels\/(?<guildId>\d+)\/(?<channelId>\d+)$/.exec(string) ?? /^<#(?<channelId>\d+)>$/.exec(string)
        const channelId = match === null  ? string
                        : /* otherwise */   match.groups.channelId
        return await message.guild.channels.fetch(channelId)
    },

    async member(string, message) {
        const match = /^<@(?<userId>\d+)>$/.exec(string)
        const userId = match === null  ? string
                     : /* otherwise */   match.groups.userId
        return await message.guild.members.fetch(userId)
    },

    async message(string, message) {
        const match =
/^https:\/\/discord.com\/channels\/(?<guildId>\d+)\/(?<channelId>\d+)\/(?<messageId>\d+)$/.exec(string)

        if (match === null) {
            return await message.channel.messages.fetch(string)
        } else {
            const channelId = match.groups.channelId
            const messageId = match.groups.messageId
            const channel = await message.guild.channels.fetch(channelId)
            return await channel.messages.fetch(messageId)
        }
    },

    async user(string, message) {
        const match = /^<@(?<userId>\d+)>$/.exec(string)
        const userId = match === null  ? string
                     : /* otherwise */   match.groups.userId
        return await message.client.users.fetch(userId)
    },
}

parsers.integer.prettyName = 'an integer'
parsers.wholeNumber.prettyName = 'a whole number (0 or more)'
parsers.string.prettyName = 'some text without spaces'
parsers.channel.prettyName = 'a channel'
parsers.member.prettyName = 'a member of the server'
parsers.message.prettyName = 'a message'
parsers.user.prettyName = 'a user (not necessarily on the server)'

// Parse a usage string into an array of objects describing arguments,
// according to the following grammar, starting at Usage:
// Usage        → Arguments?
// Arguments    → Argument (" " Arguments)?
//              | RestArgument
// Argument     → Name ":" Type
//              → '"' Identifier '"'
// Type         → Identifier
// RestArgument → "..." Name
// Name         → Identifier
// Identifier   → /[A-Za-z_]+/
// Example usage string: 'message:message "hello" ...content'
// If the usage string does not match the grammar, throw UsageSyntaxError.
const parseUsage = (usageString) => {
    if (usageString === '') {
        return []
    }

    const argumentStrings = usageString.split(' ')

    return argumentStrings.map((argumentString, index) => {
        const restMatch = /^\.\.\.(?<name>[A-Za-z_]+)$/.exec(argumentString)

        if (restMatch !== null) {
            if (index !== argumentStrings.length - 1) {
                throw new UsageSyntaxError('rest argument not at end of list')
            }

            return {
                type: 'rest',
                name: restMatch.groups.name,
            }
        }

        const literalMatch = /^"(?<literal>[A-Za-z_]+)"$/.exec(argumentString)

        if (literalMatch !== null) {
            return {
                type: 'literal',
                name: literalMatch.groups.literal,
            }
        }

        const nameTypeMatch =
/^(?<name>[A-Za-z_]+):(?<type>[A-Za-z_]+)$/.exec(argumentString)

        if (nameTypeMatch === null) {
            throw new UsageSyntaxError('malformed argument')
        }

        const parser = parsers[nameTypeMatch.groups.type]

        if (parser === undefined) {
            throw new UsageSyntaxError('unknown argument type')
        }

        return {
            type: parser,
            name: nameTypeMatch.groups.name,
        }
    })
}

// Given an arguments string, a list of possible usages for a command, and a
// Discord message, check the arguments against each usage in sequence until
// one is found that correctly parses the arguments.
// On success, return an object whose property names are argument names and
// whose values are the values corresponding to those arguments.
// On failure, return null.
const parseArguments = async (argsString, usages, message) => {
    eachUsage: for (const usage of usages) {
        let remainingArgs = argsString
        const result = {}

        for (const arg of usage) {
            if (arg.type === 'rest') {
                result[arg.name] = remainingArgs
                return result
            }

            const argMatch = /(?<next>\S+)\s*(?<rest>.*)/s.exec(remainingArgs)

            if (argMatch === null) {
                continue eachUsage
            }

            if (arg.type === 'literal') {
                if (argMatch.groups.next === arg.name) {
                    result[arg.name] = true
                } else {
                    continue eachUsage
                }
            } else {
                let parseResult
                try {
                    parseResult = await arg.type(
                        argMatch.groups.next,
                        message
                    )
                } catch (error) {
                    console.error(error)
                    continue eachUsage
                }

                if (parseResult == null) {
                    continue eachUsage
                }

                result[arg.name] = parseResult
            }

            remainingArgs = argMatch.groups.rest
        }

        if (remainingArgs === '') {
            return result
        }
    }

    return null
}

class UsageSyntaxError extends Error {}

module.exports = {
    parseUsage,
    parseArguments,
    UsageSyntaxError,
}
