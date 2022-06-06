# Ereshkigal

This is a [Discord](https://discord.com/) bot designed to help with administrative tasks in the [*Caves of Qud* official server](https://discord.gg/cavesofqud). It's open source; see [LICENSE](LICENSE).

The bot's primary design principle is *explicitness*: If something is to be allowed, it needs to be stated unambiguously. It should be difficult to do anything, especially anything with great consequences, by accident.

The bot is named after a [*Caves of Qud* character](https://wiki.cavesofqud.com/wiki/Ereshkigal).

## Usage

### Setup

This section gives instructions on how to set up the bot for the first time.

These instructions assume some knowledge of Discord, command line, git, and JSON; and that `node` and `npm` commands can be found by your shell.

1. Clone this repository and set it as the working directory. (All commands are assumed to be run in the root of this repository.)
2. Run `npm ci` to install dependencies. (*Do not* run `npm install`; this can fetch different versions of the dependencies than the ones that were developed against.)
5. Make a copy of `permissions.default.json` named `permissions.json`. Change the array associated with `"staff"` so that it contains one or more strings containing the Discord role IDs of your server's staff roles. **Only add roles that you trust with command of the bot.** (You can configure this in more detail later; see [Permissions](#Permissions).)
6. Run `node .`. If any instructions appear, follow them and then run `node .` again. Do this as many times as necessary. If `Done.` appears in the output, the bot has successfully booted and connected to Discord.
    - If you would rather disable a plugin than follow its instructions, delete the file of the appropriate name from `plugins/` or else move it elsewhere. You can re-enable it later by recreating the file, e.g., with `git reset`.

Once the bot is running, it will give some useful information if you post `!help` where it can see it and reply. (`!` is the *default* command prefix; if you've changed it, put whatever you changed it to in front of `help` instead.)

### Updating

Once the bot has already been setup, follow these instructions to update it to a new version.

1. Fetch the new version, e.g., with `git pull`.
2. Run `npm ci` to update dependencies.

If all went well, you may now run `node .` to run the new version of the bot.

## Permissions

The bot is unpermissive by default; a given user may not run any commands unless they're explicitly given permission to do so. These permissions are determined by rules given in `permissions.json`.

In this section, the `…` character in a JSON snippet stands for something that hasn't been expounded upon or that must be provided by the bot maintainer.

The basic layout of the file is an object with names `"roles"` and `"allowed"`:

    {
        "roles": …,
        "allowed": …
    }

The meanings of these are expounded in the following sections.

### Role Groups

The value of `"roles"` is itself an object whose names are the names of *role groups* to be defined. For example, if there are two role groups, called `staff` and `onboarder`, it might look like this:

    {
        "staff": […],
        "onboarder": […]
    }

The contents of the arrays seen in this snippet are strings containg Discord role IDs. Any role ID included in a role group is granted all the permissions that role group is granted. Say that your server has two roles you wish to label as staff and one role you wish to label as onboarder. Then the role groups may look like this:

    {
        "staff": ["…", "…"],
        "onboarder": ["…"]
    }

Where the `…`s must be replaced by Discord role IDs.

Discord roles that share the same role group are treated identically to each other by the bot for purposes of running commands.

### Allow Rules

The real significance of role groups is which commands each of them is allowed to run. This is determined by *allow rules*. The value of `"allowed"` is an array of rules in the order in which they will be tried. (The order doesn't change the outcome.)

Continuing with the example role groups from the previous section, say that you wish to allow staff to use *all* commands and onboarders to use just `airlockcount` and `vettinglimit` commands. Then the allow rules might look like this:

    [
        {
            "commands": "*",
            "roles": [
                "staff"
            ]
        },
        {
            "commands": [
                "airlockcount",
                "vettinglimit"
            ],
            "roles": [
                "onboarder"
            ]
        }
    ]

As seen in this snippet, each individual rule is given as an object with names `"commands"` and `"roles"`. The value of `"commands"` is either an array of strings, representing command names, or the string `"*"`, representing all commands. The value of `"roles"` is an array of strings, representing role groups (as defined in the previous section). Each rule can cover as many commands as needed, and as many role groups as needed.

In accordance with the design principles of the bot, `"*"` is *not* a valid value for `"roles"`. If some command should be executable by anyone, then a role group needs to be defined to encapsulate that.

### Summary

Putting the information from the preceding sections together, here is the final example `permissions.json` file:

    {
        "roles": {
            "staff": ["…", "…"],
            "onboarder": ["…"]
        },
        "allowed": [
            {
                "commands": "*",
                "roles": [
                    "staff"
                ]
            },
            {
                "commands": [
                    "airlockcount",
                    "vettinglimit"
                ],
                "roles": [
                    "onboarder"
                ]
            }
        ]
    }

Where the only remaining `…`s must be replaced with role IDs.

This example describes a setup where two roles are considered staff, who may execute all commands, and one role is considered onboarder, who may execute just the `airlockcount` and `vettinglimit` commands.

This is only one of many possible setups; there are no restrictions on what role groups or allow rules may be defined so long as they follow the basic structure outlined in the preceding sections. The concepts of “staff” and “onboarder” are not baked into the bot; they're only given meaning by what they can and cannot do with the bot, which is entirely contained within the `permissions.json` file.

## Acknowledgments

The plugin-based architecture is inspired by that of [LHBot](https://github.com/mindset-tk/LHBot). This bot's predecessor is a fork of LHBot, which it's designed to replace, although it deliberately doesn't come with much of the functionality of LHBot.
