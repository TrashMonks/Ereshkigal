'use strict'

const {readdir} = require('fs/promises')
const {Client, Intents} = require('discord.js')
const {loadConfig, saveConfig} = require('./config')
const {isAllowed} = require('./permissions')
const defaultConfigFileName = './config.default.json'
const configFileName = './config.json'
const pluginDirectoryName = './plugins'

const bot = {
    info: (message) => {
        console.log(message)
    },

    exitRequested: false,

    fatal: (message) => {
        // Show the message in bold red.
        console.log(`\x1b[1;31m${message}\x1b[m`)
        bot.exitRequested = true
    },

    checkFatal: () => {
        if (bot.exitRequested) {
            process.exit(1)
        }
    },

    logDiscordMessage: (message) => {
        const author = message.author
        // Show the author in bold.
        console.log(
`\x1b[1m<${author.username}#${author.discriminator}>\x1b[m ${message.cleanContent}`
        )
    },

    saveConfig: async () => {
        await saveConfig({
            fileName:   configFileName,
            config:     bot.config,
        })
    },

    run: async (argsObject) => {
        const roles = argsObject.message.member.roles.cache.keys()

        if (!isAllowed(roles, argsObject.plugin.name)) {
            bot.info(
'The preceding command was ignored due to insufficient permissions.'
            )
            return
        }

        try {
            await argsObject.action(argsObject)
        } catch (error) {
            console.error(error)
            await argsObject.message.reply(
'An unhandled exception was encountered while running that command. A stack trace has been printed to the attached terminal for a maintainer to see.'
            )
        }
    },

    formatUsage: (plugin) => {
        let usage

        switch (typeof plugin.usage) {
            case 'undefined':
                return 'There is no usage for this plugin.'
            case 'string':
                usage = [plugin.usage]
                break
            default:
                usage = plugin.usage
                break
        }

        usage = usage.map((usageLine) =>
            '    ' + bot.config.commandPrefix + usageLine
        )

        return `Usage:\n${usage.join('\n')}`
    },
}

const onReady = async () => {
    for (const plugin of bot.plugins) {
        if (plugin.ready !== undefined) {
            await plugin.ready(bot)
        }
    }

    bot.info('Done.')
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

    bot.logDiscordMessage(message)
    const command = message.content.replace(bot.config.commandPrefix, '')
    let argsObject = {bot, message}

    for (const plugin of bot.plugins) {
        if (typeof plugin.trigger === 'string') {
            if (command.startsWith(plugin.trigger)) {
                argsObject.action = plugin.action

                argsObject.args = command
                    .replace(plugin.trigger, '')
                    .replace(/^ /, '')

                argsObject.plugin = plugin
                bot.run(argsObject)
                break
            }
        } else if (plugin.trigger instanceof RegExp) {
            argsObject.action = plugin.action
            argsObject.args = plugin.trigger.exec(command)
            argsObject.plugin = plugin

            if (argsObject.args !== null) {
                bot.run(argsObject)
                break
            }
        }
    }

    bot.checkFatal()
}

void (async () => {
    // Load the configuration.

    bot.info('Loading configuration...')

    const config = bot.config = loadConfig({
        fileName:           configFileName,
        defaultFileName:    defaultConfigFileName,
    })

    await bot.saveConfig()

    if (config.token == null) {
        bot.fatal(
'Please provide a bot token by editing the "token" field in config.json. This is required so the bot can authenticate with Discord.'
        )
    }

    // Load all plugins.
    // Loading a plugin consists of:
    // - requiring it as a module;
    // - querying the intents it needs (GUILDS and GUILD_MESSAGES intents are
    //   assumed);
    // - running its initialize function if it has one.
    // All of this happens before connection so that any plugin can abort at
    // any point if its needs aren't met.

    console.group('Loading plugins...')
    const pluginFileNames = await readdir(pluginDirectoryName)
    const intentsSet = new Set(['GUILDS', 'GUILD_MESSAGES'])
    const plugins = bot.plugins = []

    for (const pluginFileName of pluginFileNames) {
        console.group(pluginFileName)
        const plugin = require(`${pluginDirectoryName}/${pluginFileName}`)
        plugin.fileName = pluginFileName
        plugins.push(plugin)

        if (plugin.intents !== undefined) {
            for (const intent of plugin.intents) {
                intentsSet.add(intent)
            }
        }

        if (plugin.initialize !== undefined) {
            await plugin.initialize(bot)
        }

        console.groupEnd()
    }

    console.groupEnd()
    await bot.saveConfig()
    bot.checkFatal()

    // Sort plugins lexicographically by name.
    plugins.sort((pluginA, pluginB) =>
        pluginA.name < pluginB.name ? -1 :
        pluginB.name > pluginB.name ?  1 :
                                       0)

    // Connect to Discord.
    bot.info('Connecting...')
    const intents = Array.from(intentsSet)

    const client = bot.client = new Client({
        intents,

        /* Default Message Options */

        // Replying to a non-existent message creates a non-reply instead.
        failIfNotExists: false,

        // Don't mention the user we're replying to.
        allowedMentions: {
            parse: ['roles', 'users'],
            repliedUser: false,
        },
    })

    bot.client = client
    client.login(config.token)
    client.on('ready', onReady)
    client.on('messageCreate', onMessageCreate)
})()
