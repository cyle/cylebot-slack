/*

	CYLEBOT for SLACK
	
	a bot that monitors your Slack instance,
	and responds to whatever you want, however you want
	
	to configure how he'll respond to things, go down
		all the way
	to the "here begins the giant list of responders!" section
	
	read the README file, too
	
	how it works, overall:

	1. cylebot subscribes to Slack via the Bot integration
	2. parse through the messages as they come in, respond as needed
	3. ...
	4. profit!
	
	more comments within...

*/

// coffeescript is needed for the slack-client lib
var CoffeeScript = require('coffee-script');
//CoffeeScript.register();

// the offical slack client lib
var slack_client = require('slack-client');

// regular old libs
var http = require('http');
var https = require('https');
var qs = require('querystring');
var fs = require('fs');

// check for a config file when calling this script, we need it
if (process.argv.length < 3 || process.argv[2] == undefined) {
	console.log('CYLEBOT requires a config file passed to it, please see README.');
	process.exit(1);
}

// load cylebot-slack config
console.log('requiring config in file: ' + process.argv[2]);
var config = require(process.argv[2]);
//console.log(config);

// primary bot config
var bot_name = config.bot_name;
var home_channel = config.home_channel;
var self_regex = new RegExp("^(.*)\\b"+bot_name+"\\b(.*)$", 'i');

// functionality config
var my_home_appserver = config.my_home_appserver;
var my_home_appserver_path = config.my_home_appserver_path;
var my_home_musicserver = config.my_home_musicserver;
var my_home_nagiosserver = config.my_home_nagiosserver;
var random_talk_interval = config.random_talk_interval;
var random_talk_wait = config.random_talk_wait;
var my_father = config.my_father;
var my_mother = config.my_mother;
var my_spouse = config.my_spouse;
var petnames = config.petnames;
var innappropriate = config.innappropriate;
var kitties = config.kitties;
var random_chatter_odds_ceiling = config.random_chatter_odds_ceiling;
var random_talk_enabled = config.random_talk_enabled;

// variables to be used globally
var users = []; // will store user IDs to usernames
var lastmessages = [];
var lastwords = [];
var lyricobj;
var poemobj;
var defineobj;
var can_talk = true;
var last_spoke;
var connected = false;
var random_talk_interval;

// init new instance of the slack real time client
var slack = new slack_client(config.api_token);

slack.on('open', function() {
	console.log(bot_name + ' is online, listening...');
	//var where = slack.getChannelGroupOrDMByID(home_channel);
	//say('hey, i\'m back, sorry', where);
	connected = true;
	//console.log(slack.users);
});

slack.on('message', function(message) {
	
	// relevant:
	// message.type = message,
	
	if (message.type == 'message') {
				
		// relevant: message.text, message.channel, message.user, message.ts
		
		// store what kind of message this is
		var message_realtype = 'unknown';
		if (message.channel[0] == 'C') {
			message_realtype = 'channel';
		} else if (message.channel[0] == 'G') {
			message_realtype = 'group';
		} else if (message.channel[0] == 'D') {
			message_realtype = 'dm';
		}
		
		// if there is no user, then it's probably not something we need to worry about
		if (message.user == undefined) {
			return;
		}
		
		// get user info
		var user_from = slack.getUserByID(message.user);
		// console.log(user_from);
		// user_from has .name and .id and more
		
		// fetch channel/group/dm object
		var where = slack.getChannelGroupOrDMByID(message.channel);
		// console.log(where);
		// where has .id and .name
		
		// log it
		if (message_realtype == 'channel' || message_realtype == 'group') {
			console.log('['+message_realtype+' ' + message.type + '] C: ' + where.name + ' U: ' + user_from.name + ' T: ' + message.text);
		} else if (message_realtype == 'dm') {
			console.log('['+message_realtype+' ' + message.type + '] C: (private) U: ' + user_from.name + ' T: ' + message.text);
		}
		
		// send the incoming message off to be parsed + responded to
		parse_message(message, user_from.name, message_realtype);
		
	} else {
		console.log(message);
		return; // do nothing with other types of messages for now
	}
});

/*

	some helper functions

*/

// add a trim() method for strings
String.prototype.trim = function() { return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

// roll dice! generates randomness throughout the bot's functionality
function rollDie(limit) {
	if (limit == undefined) limit = 6;
	return Math.floor(Math.random()*limit+1);
}

// get a random integer between range
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// make a timestamp string from the current time
function makeTS() {
	var d = new Date();
	var ts = '';
	ts = ''+((d.getMonth() < 9) ? '0': '')+(d.getMonth()+1)+'-'+((d.getDate() < 10) ? '0': '')+d.getDate()+'-'+d.getFullYear()+' '+((d.getHours() < 10) ? '0': '')+d.getHours()+':'+((d.getMinutes() < 10) ? '0': '')+d.getMinutes()+':'+((d.getSeconds() < 10) ? '0': '')+d.getSeconds()+'';
	return ts;
}

// censor a potentially inappropriate message before the bot sends it
function filterMsg(wut) {
	var appropriate = true;
	var checkthis = wut.toLowerCase();
	for (var i = 0; i < innappropriate.length; i++) {
		if (checkthis.indexOf(innappropriate[i]) > -1) {
			appropriate = false;
		}
	}
	return appropriate;
}

// pick a random kitty face emoji
function randomKittyEmoji() {
	return kitties[Math.floor(Math.random()*kitties.length)];
}

/*

	major important functions

*/

// send a message to the specified channel/group/whatever
// "where" needs to be a channel/group/dm object
function say(with_what, where) {
	// make sure message is appropriate
	if (filterMsg(with_what) == false) {
		return;
	}
	// first send typing indicator
	where.sendMessage({"type":"typing"});
	// what type of place is this going to
	var message_realtype = 'unknown';
	if (where.id[0] == 'C') {
		message_realtype = 'channel';
	} else if (where.id[0] == 'G') {
		message_realtype = 'group';
	} else if (where.id[0] == 'D') {
		message_realtype = 'dm';
	}
	// ok now send the actual message in a little while
	// this fuzziness makes cylebot seem almost human
	setTimeout(function() {
		where.send(with_what);
		console.log('['+message_realtype+' message] C: ' + where.name + ' U: cylebot T: ' + with_what);
		last_spoke = new Date();
	}, getRandomInt(500, 1200));
}

// parse incoming message object, username, and message type
function parse_message(message_obj, username, message_type) {
	
	var chatline = message_obj.text.trim();
	var chatuser = username.trim().toLowerCase();
	
	// fetch channel/group/dm object
	var where = slack.getChannelGroupOrDMByID(message_obj.channel);
	// console.log(where);
	// where has .id and .name
	
	/*
	
		here begins the giant list of responders!
	
	*/
	
	// if the bot has been shut up, and is told they can talk again, do so
	if ((self_regex.test(chatline) && /you can talk/i.test(chatline)) || chatline.toLowerCase() == '!talk') {
		say('yay! i can talk again!', where);
		can_talk = true;
		return;
	}
	
	// keep track of the last few things said, include them as possible random talking points
	if (lastmessages.length > 5) {
		var oldline = lastmessages.shift();
	}
	var newline = lastmessages.push(chatline);
	
	// keep track of the last few big words said, include them as possible random talking points
	var chatline_words = chatline.match(/\b([a-z]{9,})\b/gi);
	if (chatline_words != undefined && chatline_words.length > 0) {
		// there are big words to add!
		for (var i = 0; i < chatline_words.length; i++) {
			if (lastwords.length >= 5) {
				var old_word_item = lastwords.shift();
			}
			var new_word_item = lastwords.push(chatline_words[i]);
		}
	}
	
	// if told to shut up, then don't talk until either timer runs out or someone says you can talk again
	if (can_talk == false) {
		return;
	}
	
	// ohhh how nice... hello and goodbye, etc
	
	if (/^(hai|hello|hey|hi|hola|oh hai)$/i.test(chatline)) {
		say('oh hai '+chatuser+' :smiley_cat:', where);
		return;
	}
	
	if (/^(bai|bye|goodbye|caio|cya)$/i.test(chatline)) {
		say('lol cya :crying_cat_face:', where);
		return;
	}
	
	if (/^good morning/i.test(chatline)) {
		say('is it morning? i\'ve been here so long... :psyduck:', where);
		return;
	}
	
	if (/^good afternoon/i.test(chatline)) {
		say('oh hello :smiley_cat:', where);
		return;
	}
	
	// generic meme responders....
	
	if (/^i can break these cuffs$/i.test(chatline)) {
		say('You can\'t break those cuffs! :cop:', where);
		return;
	}
	
	if (/death metal/i.test(chatline)) {
		say('oh hell yeah death metal :metal:', where);
		return;
	}
	
	if (/^gimme dat bass$/i.test(chatline)) {
		say('Perchance is someone inquiring for an obsequious selection of that bass? :raised_hands:', where);
		return;
	}
	
	if (/help ?desk/i.test(chatline)) {
		if (rollDie(10) <= 3) {
			say('HERLPDERRSSSSSS :information_desk_person:', where);
			return;
		}
	}
	
	if (/\bnom\b/i.test(chatline)) {
		say('nom nom nom :heart_eyes_cat:', where);
		return;
	}
	
	if (/^hip hip!?$/i.test(chatline)) {
		say('horray! :smile_cat:', where);
		return;
	}
	
	if (/^what /i.test(chatline)) {
		if (rollDie(10) <= 3) {
			say('some people say the cucumbers taste better pickled... :smirk_cat:', where);
			return;
		}
	}
	
	if (/^welp/i.test(chatline)) {
		if (rollDie(10) <= 5) {
			say('you\'re tellin me :psyduck:', where);
			return;
		}
	}
	
	if (/(z|9)/i.test(chatline)) {
		if (rollDie(10) <= 3) {
			say('delicious! :sparkling_heart:', where);
			return;
		}
	}
	
	if (/\btwitter\b/i.test(chatline)) {
		var wut = '';
		switch (rollDie(3)) {
			case 1:
			wut = 'twitter!? kill it with fire!';
			break;
			case 2:
			wut = 'twitter is for losers';
			break;
			case 3:
			wut = 'twitter ugh';
			break;
		}
		say(wut + ' :pouting_cat:', where);
		return;
	}
		
		
	if (/space jam/i.test(chatline)) {
		say('Everybody get up, it\'s time to slam now! We got a real jam goin down! :basketball:', where);
		setTimeout(function() {
			say('Welcome to the SPACE JAM! :rocket:', where);
		}, getRandomInt(1000, 2000));
		return;
	}
	
	if (/^ho+p(!)?$/i.test(chatline)) {
		say('THERE IT IS! :raised_hands:', where);
		return;
	}
	
	if (/^who+mp(!)?$/i.test(chatline)) {
		say('THERE IT IS! :raised_hands:', where);
		return;
	}
	
	if (/(respect|r e s p e c t)/i.test(chatline)) {
		var wut = '';
		var roll = rollDie(4);
		switch (roll) {
			case 1:
			wut = 'find out what it means to me';
			break;
			case 2:
			wut = 'sock it to me, sock it to me';
			break;
			case 3:
			wut = 'immabout to give you allll my money';
			break;
			case 4:
			wut = 'r e s p e c t & tcb';
			break;
		}
		say(':notes: ' + wut + ' :notes:', where);
		return;
	}
	
	// !commands
	
	if (/^!(.+)$/.test(chatline)) {
		
		if (/!commands\b/i.test(chatline)) {
			say('Commands: !lyric, !poem [#], !status, !sentence, !roll [#], !song, !define [word], !fact, !server [hostname], !lastlyric, !lastpoem', where);
		}
		
		if (/!lyric\b/i.test(chatline)) {
			http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'lyric.php'}, function(res) {
				var returned = '';
				res.on('data', function (chunk) {
					returned += ''+chunk+'';
				});
				res.on('end', function() {
					if (returned != 'too bad') {
						lyricobj = JSON.parse(returned);
						say(':notes: ' + lyricobj.line + ' :notes:', where);
					} else {
						say('error getting a lyric... sorry... :crying_cat_face:', where);
					}
				});
			});
			return;
		}
		
		if (/!poem\s?(\d{1})?\b/i.test(chatline)) {
			var howmanylines = 1;
			var poem_matches = chatline.match(/!poem\s?(\d{1})?\b/i);
			if (poem_matches[1] != undefined && poem_matches[1] * 1 > 0) {
				howmanylines = poem_matches[1] * 1;
				if (howmanylines > 5) {
					howmanylines = 1;
				}
			}
			http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'poetry.php?l='+howmanylines}, function(res) {
				var returned = '';
				res.on('data', function (chunk) {
					returned += ''+chunk+'';
				});
				res.on('end', function() {
					poemobj = JSON.parse(returned);
					say(poemobj.line, where);
				});
			});
			return;
		}
		
		if (/!lastlyric\b/i.test(chatline)) {
			if (lyricobj == undefined) {
				say('there has not been a lyric spoken yet :crying_cat_face:', where);
			} else {
				if (filterMsg(lyricobj.song)) {
					say('the last lyric was from '+lyricobj.artist+' - '+lyricobj.song+' :headphones:', where);
				} else {
					say('uhhh i don\'t know where the last lyric is from... :crying_cat_face:', where);
				}
			}
			return;
		}
		
		if (/!lastpoem\b/i.test(chatline)) {
			if (poemobj == undefined) {
				say('there has not been a poem spoken yet + :crying_cat_face:', where);
			} else {
				say('the last line of poetry was from "'+poemobj.title+'" by '+poemobj.author+' :pencil2:', where);
			}
			return;
		}
		
		if (/^!status$/i.test(chatline)) {
			http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'status.php'}, function(res) {
				var returned = '';
				res.on('data', function (chunk) {
					returned += ''+chunk+'';
				});
				res.on('end', function() {
					say(returned + ' ' + randomKittyEmoji(), where);
				});
			});
			return;
		}
		
		if (/^!sentence$/i.test(chatline)) {
			http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'sentence.php'}, function(res) {
				var returned = '';
				res.on('data', function (chunk) {
					returned += ''+chunk+'';
				});
				res.on('end', function() {
					say(returned + ' ' + randomKittyEmoji(), where);
				});
			});
			return;
		}
		
		// roll the dice - either # of sides, or D&D style
		if (/^!roll\s?((\d+)|((\d+)d(\d+)))?$/i.test(chatline)) {
			var user_pieces = chatuser.split('_');
			var username = user_pieces[0].toLowerCase();
			var roll_matches = chatline.match(/^!roll\s?((\d+)|((\d+)d(\d+)))?$/i);
			if (roll_matches[2] != undefined && roll_matches[2] * 1 > 0) {
				say(username + ' rolls a '+rollDie(roll_matches[1] * 1)+ ' :game_die:', where);
			} else if ((roll_matches[4] != undefined && roll_matches[4] * 1 > 0) && (roll_matches[5] != undefined && roll_matches[5] * 1 > 0)) {
				var restext = username +' rolls ';
				var rolltotal = 0;
				for (var i = 0; i < roll_matches[4] * 1; i++) {
					if (i > 0) {
						restext += ', ';
					}
					var roll = rollDie(roll_matches[5] * 1);
					restext += roll;
					rolltotal += roll;
				}
				restext += ' = ' + rolltotal;
				say(restext + ' :game_die:', where);
			} else {
				say(username + ' rolls a '+rollDie(6) + ' :game_die:', where);
			}
			return;
		}
		
		// define a word!
		if (/^!define (\w+)/i.test(chatline)) {
			var define_pieces = chatline.match(/^!define (\w+)$/i);
			if (define_pieces == undefined || define_pieces[1] == undefined) {
				say("Uhhh I need a word to define...", where);
				return;
			}
			var theword = define_pieces[1];
			var thelookup = "/w/api.php?format=json&action=query&titles="+theword+"&prop=revisions&rvprop=content";
			http.get({host: 'en.wiktionary.org', port: 80, path: thelookup, headers: { "User-Agent": "Cylebot" } }, function(res) {
				var returned_stuff = '';
				res.on('data', function (chunk) {
					returned_stuff += ''+chunk+'';
				});
				res.on('end', function() {
					defineobj = JSON.parse(returned_stuff);
					var defineobj = defineobj['query']['pages'];
					//console.log(defineobj);
					if (defineobj['-1'] != undefined) {
						say("No definition found, sorry!", where);
						return;
					}
					var definetxt = '';
					for (var i in defineobj) {
						definetxt = '' + defineobj[i]['revisions'][0]['*'] + '';
					}
					//console.log(definetxt);
					define_matches = definetxt.match(/# (.+)\n/ig);
					if (define_matches == undefined || define_matches[0] == undefined) {
						say("No definition found, sorry!", where);
						return;
					}
					//console.log('definition matches for '+theword+':');
					//console.log(define_matches);
					for (var i = 0; i < define_matches.length; i++) {
						if (/\{\{obsolete\}\}/gi.test(define_matches[i])) {
							continue;
						} else 	if (/\{\{(.*)?rare(.*)?\}\}/gi.test(define_matches[i])) {
							continue;
						} else if (/\{\{(in)?transitive\}\}/.test(define_matches[i])) {
							continue;
						} else {
							the_definition = define_matches[i];
							break;
						}
					}
					if (the_definition == undefined || the_definition.trim() == '') {
						say("No definition found, sorry!", where);
						return;
					}
					//var the_definition = define_matches[0];
					if (/{{plural of\|(.+)}}/i.test(the_definition)) {
						the_definition = the_definition.replace(/{{plural of\|(.+)}}/ig, 'plural of $1');
					}
					if (/{{alternative spelling of\|(.+)}}/i.test(the_definition)) {
						the_definition = the_definition.replace(/{{alternative spelling of\|(.+)}}/ig, 'alternative spelling of $1');
					}
					if (/{{alternative form of\|(.+)}}/i.test(the_definition)) {
						the_definition = the_definition.replace(/{{alternative spelling of\|(.+)}}/ig, 'alternative form of $1');
					}
					the_definition = the_definition.replace(/\{\{([^}]*)\}\}/ig, '');
					the_definition = the_definition.replace(/\[\[([^\|]*\|)?/ig, '');
					the_definition = the_definition.replace(/\]\]/ig, '');
					the_definition = the_definition.substring(2);
					the_definition = the_definition.replace(/'''/g, '');
					the_definition = the_definition.replace(/''/g, '');
					if (the_definition == undefined || the_definition.trim() == '' || the_definition.trim() == '.') {
						say("No definition found, sorry!", where);
						return;
					}
					//console.log('the definition: '+the_definition);
					say(':book: ' + the_definition.trim(), where);
				});
			});
			return;
		}
		
		// get a fact!
		if (/^!fact$/i.test(chatline)) {
			http.get({host: 'facts.randomhistory.com', port: 80, path: '/'}, function(res) {
				var returned_stuff = '';
				res.on('data', function(chunk) {
					returned_stuff += ''+chunk+'';
				});
				res.on('end', function() {
					var find_fact = /<!-- Fact of the Day Starts -->([^<]+)<!-- Fact of the Day Ends -->/i;
					var fact_matches = returned_stuff.match(find_fact);
					if (fact_matches == undefined || fact_matches[1] == undefined) {
						say('Oh crap. Error getting a random fact. Sorry.', where);
						return;
					}
					var the_fact = fact_matches[1].trim();
					the_fact = the_fact.replace(/\s{2,}/g, ' ');
					the_fact = the_fact.replace(/&rsquo;/gi, "'");
					the_fact = the_fact.replace(/&ldquo;/gi, '"');
					the_fact = the_fact.replace(/&rdquo;/gi, '"');
					say(':interrobang: ' + the_fact, where);
				});
				
			});
			return;
		}
		
		// get a song from cyle's itunes library
		if (/^!song$/i.test(chatline)) {
			http.get({host: my_home_musicserver, port: 80, path: '/music.php'}, function(res) {
				var returned_stuff = '';
				res.on('data', function(chunk) {
					returned_stuff += ''+chunk+'';
				});
				res.on('end', function() {
					say(':notes: ' + returned_stuff, where);
				});
			});
			return;
		}
		
		// get server status from my Nagios API
		if (/^!server (.+)/i.test(chatline)) {
			var server_pieces = chatline.match(/^!server (.+)$/i);
			if (server_pieces == undefined || server_pieces[1] == undefined) {
				say(":satellite: Uhhh I need a server to check...", where);
				return;
			}
			// slack passes along URLs in a weird way
			var theserver = '';
			var url_pieces = server_pieces[1].match(/^<[^|]+\|(.+)>$/i);
			if (url_pieces[1] != undefined) {
				theserver = url_pieces[1];
			} else {
				theserver = server_pieces[1];
			}
			//console.log('checking nagios host status for ' + theserver);
			http.get({host: my_home_nagiosserver, port: 80, path: '/nagios/?w=host&h='+theserver}, function(res) {
				var returned_text = '';
				res.on('data', function (chunk) {
					returned_text += ''+chunk+'';
				});
				res.on('end', function() {
					var what = '';
					var host = JSON.parse(returned_text);
					//console.log(host);
					if (host.error != undefined) {
						what = host.error + '! i probably do not check on it.';
					} else {
						if (host.b == true) {
							what = 'looks like that server is broken! oh noes...';
						} else if (host.p == true) {
							what = 'looks like that server has a slight problem, but it\'s still up...';
						} else {
							what = 'that server should be fine, i think';
						}
					}
					say(':satellite: ' + what, where);
				});
			});
			return;
		}
		
	} // end if ! commands
	
	
	// respond to its name
	
	if (self_regex.test(chatline)) {
		var wut = ''; // will probably hold the response
		var bot_matches = chatline.match(self_regex);
		var said_before = bot_matches[1].toLowerCase();
		var said_after = bot_matches[2].toLowerCase();
		if (/^(.*)how are you(.*)$/i.test(chatline)) {
			http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'status.php'}, function(res) {
				var returned = '';
				res.on('data', function (chunk) {
					returned += ''+chunk+'';
				});
				res.on('end', function() {
					say(returned + ' ' + randomKittyEmoji(), where);
				});
			});
			return;
		} else if (said_before == 'thanks ' || said_before == 'thanks, ' || said_before == 'thank you ' || said_before == 'thank you, ') {
			wut = 'you are so welcome';
		} else if (said_before == 'i love you ' || said_before == 'i love you, ' || said_after == ' i love you' || said_after == ', i love you') {
			var roll = rollDie(100);
			if (roll % 2) {
				wut = 'awww i love you too! :heart:';
			} else {
				wut = 'ummm that\'s nice';
			}
		} else if (said_before == '' && (said_after == '' || said_after == '?')) {
			wut = 'yes?';
		} else if (said_before == 'oh hai ' && said_after == '') {
			wut = 'oh hai, how are you?';
		} else if (/shut up/i.test(chatline)) {
			wut = 'ok, shutting up, sorry';
			can_talk = false;
		} else if (said_after.charAt(said_after.length-1) == '?') {
			var the_question = said_before + said_after;
			the_question = the_question.replace(/[\.,\?;:]/gi, '').toLowerCase().trim();
			//wut = 'the question was: ' + the_question;
			// get first word
			var question_words = the_question.match(/\b\w+\b/gi);
			if (question_words[0] == 'do' || question_words[0] == 'is' || question_words[0] == 'are' || question_words[0] == 'can' || question_words[0] == 'does' || question_words[0] == 'did' || question_words[0] == 'should') {
				var roll = rollDie(8);
				switch (roll) {
					case 1:
					wut = 'probably not';
					break;
					case 2:
					wut = 'oh hell yes :thumbsup:';
					break;
					case 3:
					wut = 'hahaha no :stare:';
					break;
					case 4:
					wut = 'i think so...';
					break;
					case 5:
					wut = 'maybe perhaps kinda :troll:';
					break;
					case 6:
					wut = ':haha:';
					break;
					case 7:
					wut = ':psyduck:';
					break;
					case 8:
					wut = ':slowpoke:';
					break;
				}
			} else {
				var roll = rollDie(6);
				switch (roll) {
					case 1:
					wut = 'i am confused by the question';
					break;
					case 2:
					wut = "i don't know how to answer that, sorry";
					break;
					case 3:
					wut = 'ask somebody else, i don\'t know';
					break;
					default:
					// http://api.adviceslip.com/advice
					http.get({host: 'api.adviceslip.com', port: 80, path: '/advice'}, function(res) {
						var returned = '';
						res.on('data', function (chunk) {
							returned += ''+chunk+'';
						});
						res.on('end', function() {
							//console.log(returned);
							var advice = JSON.parse(returned);
							var returntext = chatuser.toLowerCase() + ', ' + advice.slip.advice.toLowerCase();
							say(returntext + ' ' + randomKittyEmoji(), where);
						});
					});
					return;
				}
				
			}
		} else {
			var roll = rollDie(100);
			if (roll < 30) {
				if (chatuser.substr(0,4).toLowerCase() == my_father) {
					wut = 'ok dad...';
				} else if (chatuser.substr(0,5).toLowerCase() == my_mother) {
					wut = 'ok mom...';
				} else if (chatuser.substr(0,4).toLowerCase() == my_spouse) {
					wut = 'ok '+petnames[rollDie(petnames.length)-1]+'...';
				} else {
					wut = 'uh okay';
				}
				say(wut + ' ' + randomKittyEmoji(), where);
				return;
			} else if (roll >= 30 && roll <= 50) {
				wut = 'uh what';
				say(wut + ' ' + randomKittyEmoji(), where);
				return;
			} else {
				http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'sentence.php'}, function(res) {
					var returned = '';
					res.on('data', function(chunk) {
						returned += ''+chunk+'';
					});
					res.on('end', function() {
						returned = chatuser.toLowerCase() + ', ' + returned;
						say(returned + ' ' + randomKittyEmoji(), where);
					});
				});
				return;
			}
		}
		var roll = rollDie(100);
		if (roll > 60) {
			wut = chatuser.toLowerCase() + ', ' + wut;
		}
		say(wut + ' ' + randomKittyEmoji(), where);
		return;
	}
	

	// random talk... if nothing else...
	
	var roll = rollDie(500);
	var wut = '';
	
	switch (roll) {
		case 1:
		wut = 'welp.';
		break;
		case 2:
		wut = 'what are you talking about?';
		break;
		case 3:
		var matches = chatline.match(/\b[\w']+\b/gi);
		if (matches != null && matches.length > 0) {
			if (filterMsg(matches[matches.length-1])) {
				wut = 'so what about "'+matches[matches.length-1]+'"?';
			} else {
				wut = 'hmm.';
			}
		} else {
			wut = 'i do not understand.';
		}
		break;
		case 4:
		case 5:
		case 6:
		case 7:
		http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'sentence.php'}, function(res) {
			res.on('data', function (chunk) {
				wut += ''+chunk+'';
			});
			res.on('end', function() {
				say(wut + ' ' + randomKittyEmoji(), where);
			});
		});
		return;
		break;
		case 8:
		wut = "does anybody know what they're talking about?";
		break;
		case 9:
		var rolltwo = rollDie(4);
		switch (rolltwo) {
			case 1:
			wut = "that's silly";
			break;
			case 2:
			wut = "i'm worried";
			break;
			case 3:
			wut = "that's a bit unwise";
			break;
			case 4:
			wut = "that's a bit upsetting";
			break;
		}
		break;
		default:
		wut = '';
	}
	
	if (wut != '') {
		say(wut + ' ' + randomKittyEmoji(), where);
	}
	
	/*
	
		here ends the giant list of responders!
	
	*/
	
}

function random_talk() {
	
	// do some random chatter
	
	var right_now = new Date();
	
	// if not between business hours, disable this
	
	// not on weekends
	if (right_now.getDay() == 0 || right_now.getDay() == 6) {
		return;
	}
	
	// not outside business hours
	if (right_now.getHours() < 9 || right_now.getHours() >= 17) {
		return;
	}
	
	var last_spoke_seconds_ago = (right_now.getTime() / 1000) - (last_spoke.getTime() / 1000);
	//console.log('last spoke ' + last_spoke_seconds_ago + ' seconds ago');
	
	if (can_talk == false || connected == false || last_spoke_seconds_ago < random_talk_wait) {
		return;
	}
	
	var where = slack.getChannelGroupOrDMByID(home_channel);
	
	var roll = rollDie(random_chatter_odds_ceiling);
	var wut = '';
	
	switch (roll) {
		case 1:
		wut = 'welp.';
		break;
		case 2:
		wut = 'what is everyone up to?';
		break;
		case 3:
		if (lastmessages.length == 0) {
			return;
		}
		var matches = lastmessages[lastmessages.length - 1].match(/\b[\w']+\b/gi);
		if (matches != null && matches.length > 0) {
			if (filterMsg(matches[matches.length-1])) {
				wut = 'so what about "'+matches[matches.length-1]+'"?';
			} else {
				wut = 'hmm.';
			}
		}
		break;
		case 4:
		case 5:
		case 6:
		case 7:
		http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'sentence.php'}, function(res) {
			res.on('data', function (chunk) {
				wut += ''+chunk+'';
			});
			res.on('end', function() {
				say(wut + ' ' + randomKittyEmoji(), where);
			});
		});
		return;
		break;
		case 8:
		wut = "hey...";
		break;
		default:
		wut = '';
	}
	
	if (wut != '') {
		say(wut + ' ' + randomKittyEmoji(), where);
	}
		
}

// actually log in and connect!
slack.login();

// set up random talk interval
if (random_talk_enabled) {
	random_talk_interval = setInterval(random_talk, random_talk_interval);
}