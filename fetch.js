const {get} = require('https')

module.exports = (uri) => {
    return new Promise((resolve, reject) => {
        get(uri, async (response) => {
            const chunks = []
            response.on('data', (data) => chunks.push(data))
            response.on('end', () => resolve(Buffer.concat(chunks).toString()))
        }).on('error', (error) => reject(error))
    })
}
