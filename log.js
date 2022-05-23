let exitRequested = false

const info = (message) => {
    console.log(message)
}

const fatal = (message, immediatelyFatal = false) => {
    // Show the message in bold red.
    console.log(`\x1b[1;31m${message}\x1b[m`)
    exitRequested = true

    if (immediatelyFatal) {
        checkFatal()
    }
}

const checkFatal = () => {
    if (exitRequested) {
        process.exit(1)
    }
}

module.exports = {
    info,
    fatal,
    checkFatal,
}
