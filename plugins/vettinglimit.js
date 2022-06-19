const {once} = require('events')
const {fatal} = require('../log')

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
        '',
        'ticketLimit:wholeNumber',
        '"cancel"',
        '"force_reset"',
    ],
    synopsis:
'Limit the number of tickets that can be opened during the next round of onboarding.',
    description:
`Invoking without arguments reports the current onboarding status.
Invoking with a number either starts onboarding (if it was inactive) or changes the active ticket limit (if it was active).
Invoking with \`cancel\` removes the ticket limit and deletes the panel, if there is one.
Invoking with \`force_reset\` makes the bot forget the state that onboarding was in and return to inactive. **If a panel was already posted, the bot will not remove it.** This should rarely be necessary.`,
    initialize(bot) {
        ({panelChannelId, panelPosterId, onboardingCategoryIds} =
            bot.config.onboarding ?? {})

        if (
            panelChannelId === undefined ||
            panelPosterId === undefined ||
            onboardingCategoryIds === undefined
        ) {
            fatal(
`Please provide onboarding configuration by editing the "onboarding" field to be an object with the following fields:
- "panelChannelId": a channel snowflake – the channel to look for panels in
- "panelPosterId": a user snowflake – the bot user that posts panels
- "onboardingCategoryIds": an array of category snowflakes – the categories to count tickets in`
            )
        }
    },

    ready({client}) {
        client.on('messageDelete', (message) => {
            if (isActive() && message.id === onboarding.panel.id) {
                onboarding.channel.send('The panel has been deleted. Shutting down onboarding.')
                onboarding = null
            }
        })
    },

    async run({ticketLimit, cancel, force_reset}, message, bot) {
        if (ticketLimit === undefined && cancel === undefined && force_reset === undefined) {
            // No arguments; report status.
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

        if (cancel) {
            if (isInactive()) {
                await message.reply('There is nothing to cancel.')
            } else {
                if (onboarding.panel === null) {
                    await message.reply('Okay, the limit has been canceled.')
                } else {
                    await onboarding.panel.delete()
                }
            }
            return
        }

        if (force_reset) {
            onboarding = null
            await message.reply('Okay, I have forgotten the previous onboarding state.')
            return
        }

        if (!isInactive()) {
            onboarding.limit = ticketLimit
            await message.reply(
`Okay, the limit has been adjusted to ${onboarding.limit}.`
            )
            return
        }

        // Enter a waiting state.
        onboarding = {
            current: 0,
            limit: ticketLimit,
            channel: message.channel,
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
    },
}
