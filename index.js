'use strict'

const {readdir} = require('fs/promises')
const {Client} = require('discord.js')
const {parseUsage, parseArguments, UsageSyntaxError} = require('./arguments')
const {loadConfig, saveConfig} = require('./config')
const {info, fatal, checkFatal} = require('./log')
const {isAllowed} = require('./permissions')
const defaultConfigFileName = './config.default.json'
const configFileName = './config.json'
const pluginDirectoryName = './plugins'

// Add ANSI sequences to the given string that cause a terminal to bold it.
const bold = (string) => `\x1b[1m${string}\x1b[m`

const logDiscordMessage = (message) => {
    const {username, discriminator} = message.author
    console.log(
        bold(`<${username}#${discriminator}>`) + ' ' + message.cleanContent
    )
}

const saveMainConfig = async () => {
    await saveConfig({
        fileName:   configFileName,
        config:     bot.config,
    })
}

const prettyUsage = (prefix, name, usage) => {
    const argStrings = []
    const typeExplanations = []

    for (const arg of usage) {
        if (arg.type === 'rest') {
            argStrings.push(`<${arg.name}>`)
            typeExplanations.push(`${arg.name} is some text`)
        } else if (arg.type === 'literal') {
            argStrings.push(arg.name)
        } else {
            argStrings.push(`<${arg.name}>`)
            typeExplanations.push(`${arg.name} is ${arg.type.prettyName}`)
        }
    }

    let result = `\`${prefix}${name}`

    if (argStrings.length !== 0) {
        result += ' ' + argStrings.join(' ')
    }

    result += '`'

    if (typeExplanations.length !== 0) {
        result += `\n    where ${typeExplanations.join(', ')}`
    }

    return result
}

const checkGuildAgainstConfiguration = (guild) => {
    if (guild.id !== bot.config.guildId) {
        console.warn(
`Leaving guild ${guild.name} (${guild.id}) because it does not match the configured guild ID (${bot.config.guildId}).`
        )
        guild.leave()
    }
}

const bot = {
    formatUsage: (plugin) => {
        let usages = plugin._usage

        if (usages === undefined) {
            return '(There is no command associated with this plugin.)'
        }

        usages = usages.map((usage) => {
            const result =
                prettyUsage(bot.config.commandPrefix, plugin.name, usage)
            return result.split('\n').map((line) => '    ' + line).join('\n')
        })

        return `Usage:\n${usages.join('\n')}`
    },
}

const onReady = async (client) => {
    // Make sure the configured guild ID is reasonable before doing anything
    // destructive.
    const guild = await client.guilds.fetch(bot.config.guildId)

    // Leave all the "wrong" guilds.
    for (const [_, guild] of client.guilds.cache) {
        checkGuildAgainstConfiguration(guild)
    }

    // Cache all members so that the bot will see changes in them.
    await guild.members.fetch()

    for (const [_, plugin] of bot.plugins) {
        if (plugin.ready !== undefined) {
            await plugin.ready(bot)
        }
    }

    client.on('guildCreate', checkGuildAgainstConfiguration)
    client.on('messageCreate', onMessageCreate)
    info('Done.')
}

const onMessageCreate = async (message) => {
    // Ignore all messages that:
    // - are from any bot, since this would be susceptible to exploits;
    // - don't begin with the command prefix.
    if (
        message.author.bot ||
        message.content === null ||
        !message.content.startsWith(bot.config.commandPrefix)
    ) {
        return
    }

    logDiscordMessage(message)
    const command = message.content.replace(bot.config.commandPrefix, '')
    const [name, argsString = ''] = command.split(/\s+(.*)/s, 2)
    const plugin = bot.plugins.get(name)
    if (plugin === undefined) { return }

    const roles = new Set(message.member.roles.cache.keys())

    if (!isAllowed(roles, name)) {
        info(
'The preceding command was ignored due to insufficient permissions.'
        )
        return
    }

    try {
        const args = await parseArguments(
            argsString,
            plugin._usage,
            message,
        )

        if (args === null) {
            message.reply(bot.formatUsage(plugin))
            return
        }

        await plugin.run(args, message, bot, plugin)
    } catch (error) {
        console.error(error)
        await message.reply(
'An unhandled exception was encountered while running that command. A stack trace has been printed to the attached terminal for a maintainer to see.'
        )
    }

    checkFatal()
}

void (async () => {
    // Load the configuration.

    info('Loading configuration...')

    const config = bot.config = loadConfig({
        fileName:           configFileName,
        defaultFileName:    defaultConfigFileName,
    })

    await saveMainConfig()

    if (config.token == null) {
        fatal(
'Please provide a bot token by editing the "token" field in config.json. This is required so the bot can authenticate with Discord.'
        )
    }

    if (config.guildId == null) {
        fatal(
'Please provide a guild ID by editing the "guildId" field in config.json. This is required because the bot is designed to work with only one guild.'
        )
    }

    // Load all plugins.
    // Loading a plugin consists of:
    // - requiring it as a module;
    // - querying the intents it needs;
    // - running its initialize function if it has one.
    // All of this happens before connection so that any plugin can abort at
    // any point if its needs aren't met.
    // GUILDS, GUILD_MEMBERS, and GUILD_MESSAGES intents are always requested.

    console.group('Loading plugins...')
    const pluginFileNames = await readdir(pluginDirectoryName)
    const intentsSet = new Set(['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES'])
    const plugins = bot.plugins = new Map

    for (const pluginFileName of pluginFileNames) {
        console.group(pluginFileName)
        const plugin = require(`${pluginDirectoryName}/${pluginFileName}`)
        plugin.fileName = pluginFileName
        plugins.set(plugin.name, plugin)

        if (plugin.intents !== undefined) {
            for (const intent of plugin.intents) {
                intentsSet.add(intent)
            }
        }

        if (plugin.usage !== undefined) {
            const usage = Array.isArray(plugin.usage) ? plugin.usage
                        : /* otherwise */               [plugin.usage]

            try {
                plugin._usage = usage.map(parseUsage)
            } catch (error) {
                if (error instanceof UsageSyntaxError) {
                    fatal(`Syntax error in usage: ${error.message}`)
                } else {
                    throw error
                }
            }
        }

        if (plugin.initialize !== undefined) {
            await plugin.initialize(bot)
        }

        console.groupEnd()
    }

    console.groupEnd()
    await saveMainConfig()
    checkFatal()

    // Connect to Discord.
    info('Connecting...')
    const intents = Array.from(intentsSet)

    const client = bot.client = new Client({
        intents,

        /* Default Message Options */

        // Replying to a non-existent message creates a non-reply instead.
        failIfNotExists: false,

        // Turn off mentions by default.
        allowedMentions: {
            parse: [],
            repliedUser: false,
        },
    })

    client.login(config.token)
    client.on('ready', onReady)
})()
