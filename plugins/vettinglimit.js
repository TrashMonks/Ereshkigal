const {once} = require('events')

let panelChannelId
let panelPosterId
let onboardingCategoryIds

let onboarding = null

const isActive = () => onboarding !== null && onboarding.panel !== null
const isWaiting = () => onboarding !== null && onboarding.panel === null
const isInactive = () => onboarding === null

module.exports = {
    name: 'vettinglimit',

    usage: [
        'vettinglimit – Check ticket limit status.',
        'vettinglimit <ticket limit> – Set a ticket limit.',
        'vettinglimit cancel – Cancel a ticket limit.',
    ],

    synopsis:
'Limit the number of tickets that can be opened during the next round of onboarding.',
    description:
`Invoking without arguments reports the current onboarding status.
Invoking with a number either starts onboarding (if it was inactive) or changes the active ticket limit (if it was active).
Invoking with \`cancel\` removes the ticket limit and deletes the panel, if there is one.`,
    trigger: 'vettinglimit',

    initialize(bot) {
        ({panelChannelId, panelPosterId, onboardingCategoryIds} =
            bot.config.onboarding ?? {})

        if (
            panelChannelId === undefined ||
            panelPosterId === undefined ||
            onboardingCategoryIds === undefined
        ) {
            bot.fatal(
`Please provide onboarding configuration by editing the "onboarding" field to be an object with the following fields:
- "panelChannelId": a channel snowflake – the channel to look for panels in
- "panelPosterId": a user snowflake – the bot user that posts panels
- "onboardingCategoryIds": an array of category snowflakes – the categories to count tickets in`
            )
        }
    },

    async action({args, message, bot, plugin}) {
        const match = /^(?<limit>.+)$/s.exec(args)

        // If no arguments are given, report what state onboarding is in.
        if (match === null) {
            if (isInactive()) {
                await message.reply(
'Inactive. No ticket limit is currently being tracked.'
                )
            } else if (isWaiting()) {
                await message.reply('Waiting for a panel to be posted.')
            } else {
                await message.reply(
`Active. ${onboarding.current}/${onboarding.limit} tickets have been opened.`
                )
            }

            return
        }

        if (match.groups.limit === 'cancel' && !isInactive()) {
            if (onboarding.panel === null) {
                await message.reply('Okay, the limit has been canceled.')
            } else {
                await onboarding.panel.delete()
                await message.reply(
'Okay, the limit has been canceled and the panel deleted.'
                )
            }

            // Enter an inactive state.
            onboarding = null
            return
        }

        const limit = Number(match.groups.limit)

        if (isNaN(limit)) {
            await message.reply(bot.formatUsage(plugin))
            return
        }

        if (!isInactive()) {
            onboarding.limit = limit
            await message.reply(
`Okay, the limit has been adjusted to ${onboarding.limit}.`
            )
            return
        }

        // Enter a waiting state.
        onboarding = {
            current: 0,
            limit,
            panel: null,
        }

        let okayMessage =
`Okay, go ahead and post the panel in <#${panelChannelId}>`
        const panelCommandReminder = bot.config.onboarding.panelCommandReminder

        if (panelCommandReminder === undefined) {
            okayMessage += '.'
        } else {
            okayMessage +=
` by sending \`${panelCommandReminder}\` in that channel.`
        }

        await message.reply(okayMessage)
        let foundMessage

        while (true) {
            [foundMessage] = await once(bot.client, 'messageCreate')

            // Quit if another command invocation changed onboarding state.
            if (!isWaiting()) {
                return
            }

            if (
                foundMessage.channel.id === panelChannelId &&
                foundMessage.author.id === panelPosterId
            ) {
                break
            }
        }

        // Enter an active state.
        onboarding.panel = foundMessage

        await message.reply(
`Okay, I found the panel. It will be deleted when the limit of ${onboarding.limit} is reached or when \`${bot.config.commandPrefix}vettinglimit cancel\` is run.`
        )

        while (true) {
            const [channel] = await once(bot.client, 'channelCreate')

            // Quit if another command invocation changed onboarding state.
            if (!isActive()) {
                return
            }
            
            if (onboardingCategoryIds.includes(channel.parentId)) {
                onboarding.current++

                if (onboarding.current >= onboarding.limit) {
                    break
                }
            }
        }

        await onboarding.panel.delete()
        await message.reply(
`The limit of ${onboarding.limit} has been reached and the panel has been deleted.`
        )

        // Enter an inactive state.
        onboarding = null
    },
}
