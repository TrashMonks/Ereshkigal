'use strict'

const {readdir} = require('fs/promises')
const {Client, Intents} = require('discord.js')
const {loadConfig, saveConfig} = require('./config')
const defaultConfigFileName = './config.default.json'
const configFileName = './config.json'
const pluginDirectoryName = './plugins'

const bot = {
    info: (message) => {
        console.log(message)
    },

    fatal: (message) => {
        // Show the message in bold red.
        console.log(`\x1b[1;31m${message}\x1b[m`)
        process.exit(1)
    },

    logDiscordMessage: (message) => {
        const author = message.author
        // Show the author in bold.
        console.log(
`\x1b[1m<${author.username}#${author.discriminator}>\x1b[m \
${message.cleanContent}`
        )
    },

    saveConfig: async () => {
        await saveConfig({
            fileName:   configFileName,
            config:     bot.config,
        })
    },

    run: async (argsObject) => {
        try {
            await argsObject.action(argsObject)
        } catch (error) {
            console.error(error)

            await argsObject.message.reply(
'An unhandled exception was encountered while running that command. A stack \
trace has been printed to the attached terminal for a maintainer to see.'
            )
        }
    },

    formatUsage: (plugin) =>
        `Usage: ${bot.config.commandPrefix}${plugin.usage}`,
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

    // All commands only work for staff.
    if (!(message.member?.roles.cache.has(bot.config.staffRole) ?? false)) {
        return
    }

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
'Please provide a bot token by editing the "token" field in config.json. This \
is required so the bot can authenticate with Discord.'
        )
    } else if (config.staffRole == null) {
        bot.fatal(
'Please provide the staff role ID by editing the "staffRole" field in \
config.json. This is required because only staff are authorized to trigger \
commands.'
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

    // Sort plugins lexicographically by name.
    plugins.sort((pluginA, pluginB) =>
        pluginA.name < pluginB.name ? -1 :
        pluginB.name > pluginB.name ?  1 :
                                       0)

    // Connect to Discord.
    bot.info('Connecting...')
    const intents = Array.from(intentsSet)
    const client = bot.client = new Client({intents, failIfNotExists: false})
    bot.client = client
    client.login(config.token)
    client.on('ready', onReady)
    client.on('messageCreate', onMessageCreate)
})()
