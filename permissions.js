const {loadConfig, saveConfig} = require('./config')
const defaultPermissionsFileName = './permissions.default.json'
const permissionsFileName = './permissions.json'

const permissions = Object.freeze(loadConfig({
    fileName:           permissionsFileName,
    defaultFileName:    defaultPermissionsFileName,
}))

// The permissions file specifies command permission in terms of role groups.
// Since permissions are always checked in terms of individual roles instead of
// groups, it's more convenient to look them up by individual role, so a cache
// is populated for that purpose.

// The cache is a map whose keys are roles and whose values are either:
// - '*', meaning all commands; or
// - a set of commands.

const cache = new Map

// Populate the cache.
for (const rule of permissions.allowed) {
    for (const roleGroup of rule.roles) {
        for (const role of permissions.roles[roleGroup]) {
            const cachedCommands = cache.get(role)
            // * is already cached, so there is nothing to do.
            if (cachedCommands === '*') {
                continue
            // * supercedes anything that was already cached.
            } else if (rule.commands === '*') {
                cache.set(role, '*')
            // There are no commands cached yet for this role; make a new set.
            } else if (cachedCommands === undefined) {
                cache.set(role, new Set(rule.commands))
            // There are commands already cached; add to the existing set.
            } else {
                for (const command of rule.commands) {
                    cachedCommands.add(command)
                }
            }
        }
    }
}

const roleIsAllowed = (role, command) => {
    const commands = cache.get(role)
    return commands === '*' || (commands?.has(command) ?? false)
}

const isAllowed = (roles, command) => {
    for (const role of roles) {
        if (roleIsAllowed(role, command)) {
            return true
        }
    }

    return false
}

module.exports = {
    isAllowed,
}
