const {writeFile} = require('fs/promises')

module.exports = {
    loadConfig({fileName, defaultFileName}) {
        const defaultConfig = require(defaultFileName)
        let loadedConfig

        try {
            loadedConfig = require(fileName)
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                loadedConfig = null
            } else {
                throw error
            }
        }

        return Object.assign(Object.create(null), defaultConfig, loadedConfig)
    },

    async saveConfig({fileName, config}) {
        await writeFile(fileName, JSON.stringify(config, null, 4))
    },
}
