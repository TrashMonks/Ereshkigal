const {loadConfig, saveConfig} = require('./config')
const defaultPermissionsFileName = './permissions.default.json'
const permissionsFileName = './permissions.json'

const permissions = Object.freeze(loadConfig({
    fileName:           permissionsFileName,
    defaultFileName:    defaultPermissionsFileName,
}))

// The permissions configuration uses human-readable names for allow rules, but
// we're expecting to be given less readable internal identifiers, so we build
// up a reverse lookup table here once instead of searching for the appropriate
// role every time we're asked to check a permission.

const roleIdsToAliases = new Map()

for (const roleAlias of Object.keys(permissions.roles)) {
    for (const roleId of permissions.roles[roleAlias]) {
        roleIdsToAliases.set(roleId, roleAlias)
    }
}

module.exports = {
    isAllowed(roleIds, command) {
        const roleAliasesSet = new Set()

        for (const roleId of roleIds) {
            const roleAlias = roleIdsToAliases.get(roleId)

            if (roleAlias !== undefined) {
                roleAliasesSet.add(roleAlias)
            }
        }

        for (const rule of permissions.allowed) {
            // Grant access if:
            // - the rule applies to all commands OR specifically this one
            // - and the rule applies to at least one of the provided roles
            if (
                (rule.commands === '*' || rule.commands.includes(command)) &&
                rule.roles.some((role) => roleAliasesSet.has(role))
            ) {
                return true
            }
        }

        return false
    }
}
