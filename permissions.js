class PermissionSet {
    static ruleMatches(rule, {role, command, channel}) {
        return role === rule.role &&
               (command === '*' || rule.command === '*' || command === rule.command) &&
               (channel === '*' || rule.channel === '*' || channel === rule.channel)
    }
    /*
        Create a new permission set based on a configuration.

        The argument must be an object with the following properties:
        - roles: an object whose property values are arrays
        - channels: an object whose property values are arrays
        - allowed: an array of objects with the following properties:
            - roles: an array
            - commands: '*' or an array
            - channels: '*' or an array

        The outer roles and channels values are lookup tables used to resolve
        aliases used in rules to actual roles and channels. The rules are the
        elements of the allowed array. Each rule specifies what roles may
        execute what command in what channel. If '*' is given (when valid), it
        means any.

        Besides the constructor, everything in this class is agnostic of this
        format. In particular, nothing else uses the role and channel aliases.
        The format is itself agnostic of what it's used for, but is designed to
        work with Discord's role system.
    */
    constructor (data) {
        for (const rule of data.allowed) {
            // TODO: Error on missing names.
            // TODO: Error on * for roles.
            const roles =
                rule.roles.flatMap((name) => data.roles[name])
            const commands = rule.commands === '*' ? ['*'] :
                rule.commands
            const channels = rule.channels === '*' ? ['*'] :
                rule.channels.flatMap((name) => data.channels[name])

            for (const role of roles) {
                for (const command of commands) {
                    for (const channel of channels) {
                        this.addRule({role, command, channel})
                    }
                }
            }
        }
    }

    allows({roles, command, channel}) {
        return roles.some((role) =>
            this.findRule({role, command, channel}) !== undefined)
    }

    getAllowed({roles, channel}) {
        const result = roles.flatMap((role) =>
            this.findRules({role, command: '*', channel}))
        .map((rule) => rule.command)

        if (result.some((command) => command === '*')) {
            return '*'
        } else {
            return result
        }
    }

    findRule({role, command, channel}) {
        return Array.from(this.#rules).find((rule) =>
            PermissionSet.ruleMatches(rule, {role, command, channel}))
    }

    findRules({role, command, channel}) {
        return Array.from(this.#rules).filter((rule) =>
            PermissionSet.ruleMatches(rule, {role, command, channel}))
    }

    addRule({role, command, channel}) {
        this.#rules.add(Object.freeze({role, command, channel}))
    }

    #rules = new Set;
}

module.exports = {PermissionSet}
