This is a Discord bot whose plugin architecture is inspired by that of [LHBot](https://github.com/mindset-tk/LHBot). It's designed specifically to help with administrative tasks for the *Caves of Qud* Discord.

## Usage

Once you have a local copy of the bot, you can run it for the first time by doing the following (assuming the working directory is the repository's root):

1. Run `npm ci` to install dependencies.
2. Run `node .` or `cp config.default.json config.json` to generate the configuration file.
3. Change the `"token"` field in `config.json` to a string containing a Discord bot token. (More information is available through the [Discord Developer Portal](https://discord.com/developers/applications).)
4. Change the `"staffRole"` field in `config.json` to a string containing the ID of the role that server members are required to have in order to run the bot commands.
5. Run `node .`. If `Done.` appears in the terminal output, the bot has successfully booted.

Thereafter, only `node .` is required to run the bot.
