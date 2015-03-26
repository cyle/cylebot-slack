# CYLEBOT for SLACK!

Cylebot is a chatbot who makes office life a little more interesting. In many ways, he is custom tailored for life in Emerson College's IT department, but anyone can use this code as a basis for their own bot. Specifically, this bot is made for us with the awesome [Slack](https://slack.com/) chat service.

Cylebot has one main form of interaction: responding directly to things happening in chat. There's one major block of code to customize in `cylebot.js`. Every time something is said in the chatroom, cylebot goes through a list of regular expressions and if any match, he'll interact. Some of them are classic IRCbot-style commands starting with an exclamation point (such as `!roll 2d10` to roll two 10-sided dice and get the result), while others are more complicated, such as asking him how he's doing.

NOTE: Some of the interaction won't work and may cause the bot to crash if you don't have all of it set up properly. Some of the commands rely on an application server. Currently, I'm not including that with this release, so you may want to disable that functionality by just deleting the responders. See the `cylebot.js` code itself for more info.

## Cylebot Commands

- `!lyric` -- returns a random lyric from a Lyrics Wiki based on a preset selection of artists.
- `!poem` -- returns a random line or lines (if a number is given as well) of poetry from his database of poetry.
- `!status` -- returns a random status update, based on his knowledge repository, explained later. Equivalent of asking "cylebot, how are you?"
- `!sentence` -- returns a random sentence from wiktionary.org list of phrases.
- `!roll [sides or notation]` -- rolls a die for you! even accepts D&D notation, i.e. !roll 4d10
- `!song` -- returns a random song from a server with a special iTunes library scrubber on it
- `!server [server hostname]` -- returns the current status of server (based on [my Nagios API](https://github.com/cyle/nagios-cache-api))
- `!lastlyric` and `!lastpoem` -- these return what the last lyric or last poem was from

There's a lot more functionality that's not covered by distinct commands, and part of the fun is figuring those out!

## Changelog

**2.0** - Refactoring of Cylebot to use Slack's new real time messaging APIs, so Cylebot is CONSTANTLY CONNECTED and more like a real human.
**1.0** - Initial release of Cylebot for Slack relied on scraping the last X minutes of chat activity, and responding via Slack's API, not using the new real time messaging APIs.

## Upgrading

If you're running Cylebot for Slack 1.0, you'll need to migrate your old config options to the new config file. If you set up custom autoresponders within Cylebot's code itself, you should be able to easily copy-and-paste them into this new version; the core functionality remains the same.

## Requirements

For the bot itself:

- Node.js v0.10+ or io.js v1.0.0+
- a team on [Slack](https://slack.com/)
- a bot integration with an API token for Cylebot

For the bot's external functionality (not included yet):

- MongoDB (running 2.4.9 in production)
- Lighttpd (running 1.4.28 in production)
- PHP 5.3+ (running 5.3.10 in production)
- PHP Mongo PECL extension (running 1.4.3 in production)

## Installation

Clone this repo somewhere.

Run `npm install` to install dependencies. (Hint: coffee-script is needed, so `npm -g install coffee-script`.)

Rename `cylebot.config-sample.js` to `cylebot.config.js` and edit it to add your API token for Cylebot and other options!

After this, you'll undoubtedly want to edit his responders, which are found starting after the comment block "here begins the giant list of responders!" and ending before the comment block "here ends the giant list of responders!". Have fun!

## Usage

To run with node via CLI:

`node cylebot.js /path/to/config.production.js`

Or with `forever`:

`forever start cylebot.js /path/to/config.production.js`

He just works! He'll join any chatroom you invite him to and start doing neat things based on how you've set up his responders.

## Considerations

There are a lot of commands/things that are very Emerson- or IT-specific. He also has an array called "inappropriate" to help filter out NSFW words; I suggest you fill that in.

The "music"/!song command -- which retrieves a random song selection from an iTunes library -- is a separate piece entirely which I have not yet put on github. It basically just asks my work machine to parse my iTunes library XML file and return a random entry. I'll add this to github at some point.

There are several !commands which rely on outside APIs and services, namely the !lyric, !fact, !status, !define, and !server commands. The !server command requires use of [my Nagios API](https://github.com/cyle/nagios-cache-api), so if you're not doing anything like that, it may be better to just wipe that out. The other four commands listed a minute ago are based on various sites around the web, so the server will need to be able to access those sites for those commands to work.

## Need to do...

Really need to make his custom external dependences (like !poem and !status) available.

## References

- node-slack-client: https://github.com/slackhq/node-slack-client
- bot users guide: https://api.slack.com/bot-users
- real-time messaging (RTM) API: https://api.slack.com/rtm