'use strict'

const {readdir, writeFile} = require('fs/promises')
const {Client, Intents} = require('discord.js')
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
        await writeFile(configFileName, JSON.stringify(bot.config, null, 4))
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

const onMessageCreate = async (message) => {
    // Ignore all messages that don't begin with the command prefix.
    if (
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
    const defaultConfig = require(defaultConfigFileName)
    let loadedConfig

    try {
        loadedConfig = require(configFileName)
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            loadedConfig = null
        } else {
            throw error
        }
    }

    const config = bot.config = Object.create(null)
    Object.assign(config, defaultConfig, loadedConfig)
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
    // Loading a plugin consists of requiring it as a module and then querying
    // the intents it needs. (GUILDS and GUILD_MESSAGES intents are assumed.)

    bot.info('Loading plugins...')
    const pluginFileNames = await readdir(pluginDirectoryName)
    const intentsSet = new Set(['GUILDS', 'GUILD_MESSAGES'])
    const plugins = bot.plugins = []

    for (const pluginFileName of pluginFileNames) {
        const plugin = require(`${pluginDirectoryName}/${pluginFileName}`)
        plugin.fileName = pluginFileName
        plugins.push(plugin)

        if (plugin.intents !== undefined) {
            for (const intent of plugin.intents) {
                intentsSet.add(intent)
            }
        }
    }

    // Sort plugins lexicographically by name.
    plugins.sort((pluginA, pluginB) =>
        pluginA.name < pluginB.name ? -1 :
        pluginB.name > pluginB.name ?  1 :
                                       0)

    // Connect to Discord.

    bot.info('Connecting...')
    const intents = Array.from(intentsSet)
    const client = new Client({intents})
    client.login(config.token)

    // Wait until the connection is established.
    client.on('ready', async () => {
        // Call any per-plugin post-login logic.

        bot.info('Initializing plugins...')

        for (const plugin of plugins) {
            if (plugin.initialize !== undefined) {
                console.group(plugin.fileName)
                await plugin.initialize(bot)
                console.groupEnd()
            }
        }

        client.on('messageCreate', onMessageCreate)
        await bot.saveConfig()
        bot.info('Done.')
    })
})()
