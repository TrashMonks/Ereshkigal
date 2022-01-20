This is a Discord bot whose plugin architecture is inspired by that of [LHBot](https://github.com/mindset-tk/LHBot). It's designed specifically to help with administrative tasks for the *Caves of Qud* Discord.

## Usage

(More complete usage instructions to come.)

Once you have a local copy of the bot, you can run it for the first time by doing the following (assuming the working directory is the repository's root):

1. Run `npm ci` to install dependencies.
2. Run `node .` or `cp config.default.json config.json` to generate the configuration file.
3. Change the `"token"` field in `config.json` to a string containing a Discord bot token. (More information is available through the [Discord Developer Portal](https://discord.com/developers/applications).)
4. Run `node .`. If `Done.` appears in the terminal output, the bot has successfully booted.

Thereafter, only `node .` is required to run the bot.

### Permissions

If you've *only* followed the preceding steps, no one will be able to run any commands yet, although the non-command functionality will still run. To enable commands, first run `cp permissions.default.json permissions.json` to generate the permissions file. You will at the very least need to edit it to specify which roles the human-readable strings (e.g., `"staff"` and `"onboarder"` in the default file) correspond to.

In the Discord client, with developer mode enabled in the settings, obtain the role ID for the role or roles you wish to consider to be staff. (Full instructions not included here (yet).) **Take care to only specify trusted roles, as they will be able to use the bot to perform admin actions.** Locate this line in the permissions file:

            "staff": [],

Now edit it to contain the IDs you found, like so:

            "staff": [
                "a role id",
                "another role id",
                "yet another role id"
            ],

where instead of `a role id`, `another role id`, and `yet another role id`, you instead put the actual role IDs, which are strings of digits. You can specify any number of them that you wish.

If you've done this correctly and have otherwise not changed the permissions from the default, when you start the bot, all the roles you specified should be able to run all commands available to the bot.

The default permissions are only suggestions; neither `"staff"` nor `"onboarder"` mean anything special to the bot itself. They only have meaning insofar as the permissions file gives them meaning.
