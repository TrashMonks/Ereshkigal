'use strict'

require('toml-require').install()
const {copyFile, readdir} = require('fs/promises')
const {Client, GatewayIntentBits} = require('discord.js')
const {parseUsage, parseArguments, UsageSyntaxError} = require('./arguments')
const {info, fatal, checkFatal, logDiscordMessage} = require('./log')
const {PermissionSet} = require('./permissions')
const configFileName = './config.toml'
const defaultConfigFileName = './config.default.toml'
const pluginDirectoryName = './plugins'

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

const checkGuildAgainstConfiguration = async (guild) => {
    if (guild.id !== bot.config.guildId) {
        console.warn(
`Leaving guild ${guild.name} (${guild.id}) because it does not match the configured guild ID (${bot.config.guildId}).`
        )
        await guild.leave()
    }
}

let lastMembersUpdate

// Cache all guild members, but only at most once every 30 minutes.
const updateMembersCache = async (guild) => {
    const now = Date.now()
    if (lastMembersUpdate == null || now - lastMembersUpdate >= 1000 * 60 * 30) {
        await guild.members.fetch()
        lastMembersUpdate = now
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
    const guild = bot.guild = await client.guilds.fetch(bot.config.guildId)

    // Leave all the "wrong" guilds.
    for (const [_, guild] of client.guilds.cache) {
        await checkGuildAgainstConfiguration(guild)
    }

    updateMembersCache(guild)

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

    updateMembersCache(message.guild)
    logDiscordMessage(message)
    const command = message.content.replace(bot.config.commandPrefix, '')
    const [name, argsString = ''] = command.split(/\s+(.*)/s, 2)
    const plugin = bot.plugins.get(name)
    if (plugin === undefined) { return }

    if (!bot.permissions.allows({
        roles: Array.from(message.member.roles.cache.keys()),
        command: name,
        channel: message.channel.id})) {
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
    info('Loading configuration...')

    let config
    try {
        config = require(configFileName)
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            // The config is missing. Create one.
            await copyFile(defaultConfigFileName, configFileName)
            config = require(configFileName)
            info(
`A new config file was created for you, ${configFileName}. You will need to edit it to configure the bot.`
            )
        } else {
            throw error
        }
    }
    bot.config = config

    if (config.token == null) {
        fatal(
`Please provide a bot token by editing the "token" field in ${configFileName}. This is required so the bot can authenticate with Discord.`
        )
    }

    if (config.guildId == null) {
        fatal(
`Please provide a guild ID by editing the "guildId" field in ${configFileName}. This is required because the bot is designed to work with only one guild.`
        )
    }

    bot.permissions = new PermissionSet(config.permissions)

    // Load all plugins.
    // Loading a plugin consists of:
    // - requiring it as a module;
    // - running its initialize function if it has one.
    // This happens before connection so that any plugin can abort at any point
    // if its needs aren't met.

    console.group('Loading plugins...')

    // Decide which plugins to load.

    // If discoverPlugins is set to true, find plugins by reading the plugins
    // directory.
    const pluginFileNames =
        config.discoverPlugins ? new Set((await readdir(pluginDirectoryName)).map((fileName) => fileName.match(/^[^.]*/)[0]))
      : /* otherwise */          new Set

    if (config.plugins === undefined) {
        config.plugins = Object.create(null)
    }

    // Handle all plugins that are explicitly enabled or disabled.
    // Note that plugins are resolved by their module name, not the plugin name
    // given in their exports, because they're not required in the first place
    // if they're disabled.
    for (const pluginName of Object.keys(config.plugins)) {
        if (config.plugins[pluginName]) {
            pluginFileNames.add(pluginName)
        } else {
            pluginFileNames.delete(pluginName)
        }
    }

    const plugins = bot.plugins = new Map

    for (const pluginFileName of pluginFileNames) {
        console.group(pluginFileName)
        const plugin = require(`${pluginDirectoryName}/${pluginFileName}`)
        plugin.fileName = pluginFileName
        plugins.set(plugin.name, plugin)

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
    checkFatal()

    // Connect to Discord.
    info('Connecting...')
    const client = bot.client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],

        /* Default Message Options */

        // Replying to a non-existent message creates a non-reply instead.
        failIfNotExists: false,

        // Turn off mentioning the replied-to user but allow explicit user
        // mentions by default.
        allowedMentions: {
            parse: ['users'],
            repliedUser: false,
        },
    })

    client.login(config.token)
    client.on('ready', onReady)
})()
