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
    usage: ['vettinglimit <ticket limit>', 'vettinglimit cancel'],

    synopsis:
'Limit the number of tickets that can be opened during the next round of \
onboarding. If a limit is already in place, set a new limit.',

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
'Please provide onboarding configuration by editing the "onboarding" field to \
be an object with the following fields:\n\
- "panelChannelId": a channel snowflake – the channel to look for panels in\n\
- "panelPosterId": a user snowflake – the bot user that posts panels\n\
- "onboardingCategoryIds": an array of category snowflakes – the categories \
to count tickets in'
            )
        }
    },

    async action({args, message, bot, plugin}) {
        const match = /^(?<limit>.+)$/s.exec(args)

        // If no arguments are given, report what state onboarding is in.
        if (match === null) {
            if (isInactive()) {
                message.reply(
'Inactive. No ticket limit is currently being tracked.'
)
            } else if (isWaiting()) {
                message.reply('Waiting for a panel to be posted.')
            } else {
                message.reply(
`Active. ${onboarding.current}/${onboarding.limit} tickets have been opened.`
                )
            }

            return
        }

        if (match.groups.limit === 'cancel' && !isInactive()) {
            // Enter an inactive state.
            onboarding = null

            message.reply(
'Okay, the limit has been canceled. If there is a panel, you will need to \
delete it manually if you want to stop.'
            )

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

        await message.reply(
`Okay, go ahead and post the panel in <#${panelChannelId}>.`
        )

        let foundMessage

        while (true) {
            [foundMessage] = await once(bot.client, 'messageCreate')

            // Quit if another command invocation canceled the onboarding.
            if (isInactive()) {
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
`Okay, I found the panel. It will be deleted when the limit of \
${onboarding.limit} is reached.`
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
`The limit of ${onboarding.limit} has been reached and the panel has been \
deleted.`
        )

        // Enter an inactive state.
        onboarding = null
    },
}
