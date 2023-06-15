const {readFile} = require('fs/promises')
const {fatal, info} = require('../log')

let entries
let buffers = new Map
let totalWeight = 0

const initialize = async ({config}) => {
    ({banners: entries} = config ?? {})

    if (entries === undefined) {
        fatal(
'Please specify banners by editing the "banners" field.'
        )
    }

    for (const entry of entries) {
        buffers.set(entry.fileName, await readFile(entry.fileName))
        totalWeight += entry.weight
    }
}

const ready = ({guild}) => {
    const processBanner = async () => {
        const weight = Math.floor(Math.random() * totalWeight)
        let weightSoFar = 0
        let fileName
        for (const entry of entries) {
            weightSoFar += entry.weight
            if (weight < weightSoFar) {
                fileName = entry.fileName
                break
            }
        }
        info(`hourly-banner: selected ${fileName}`)
        const buffer = buffers.get(fileName)
        await guild.setBanner(buffer)
    }

    void function run() {
        const now = new Date()
        const next = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours() + 1,
            //now.getHours(),
            //now.getMinutes(),
            //now.getSeconds() + 1,
        )

        setTimeout(async () => {
            await processBanner()
            run()
        }, next - now)
    }()
}

module.exports = {
    name: 'hourly-banner',
    synopsis: 'Randomly set the banner each hour.',
    description: 'At the beginning of each hour, the bot randomly selects an image from among those in the config according to the assigned weights, and sets the server banner to it.',
    initialize,
    ready,
}
