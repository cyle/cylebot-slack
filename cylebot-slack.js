/*

	CYLEBOT for SLACK
	
	a bot that monitors a channel or private group on Slack,
	and responds to whatever you want, however you want
	
	to configure how he'll respond to things, go down
		all the way
	to the "here begins the giant list of responders!" section
	
	read the README file, too
	
	how it works, overall:

	1. every 2 seconds, grab the latest chats from the specified channel/group
		- update the latest_chat_check with the latest returned message's timestamp
	2. parse through the messages, respond as needed
	3. ...
	4. profit!
	
	more comments within...

*/

var http = require('http');
var https = require('https');
var qs = require('querystring');
var fs = require('fs');

if (process.argv.length < 3 || process.argv[2] == undefined) {
	console.log('CYLEBOT requires a config file passed to it, please see README.');
	process.exit(1);
}

// Slack config
console.log('requiring config in file: ' + process.argv[2]);
var config = require(process.argv[2]);
var api_token = config.api_token;
var group_id = config.group_id;
var ts_file = config.last_check_file;

// bot config
var bot_name = config.bot_name;
var self_regex = new RegExp("^(.*)\\b"+bot_name+"\\b(.*)$", 'i');

// functionality config
var my_home_appserver = config.my_home_appserver;
var my_home_appserver_path = config.my_home_appserver_path;
var my_home_musicserver = config.my_home_musicserver;
var my_home_nagiosserver = config.my_home_nagiosserver;
var my_father = config.my_father;
var my_mother = config.my_mother;
var my_spouse = config.my_spouse;
var petnames = config.petnames;
var innappropriate = config.innappropriate;
var kitties = config.kitties;

// variables to be used globally
var latest_chat_check = '0'; // unix epoch timestamp of when the latest message was received
var users = []; // will store user IDs to usernames
var lastmessages = [];
var lastwords = [];
var lyricobj;
var poemobj;
var defineobj;
var can_talk = true;

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

	actual bot functionality

*/

// get latest chat lines
// limits to 100 by default, which should be enough
//   https://slack.com/api/groups.history?token=xxx&channel=xxx
function getLatestChats() {
	//console.log('getting latest chats...');
	
	// need to switch out API calls based on channel vs private group
	var which_kind_of_chat = '';
	if (group_id.substring(0, 1) == 'G') {
		which_kind_of_chat = 'groups';
	} else if (group_id.substring(0, 1) == 'C') {
		which_kind_of_chat = 'channels';
	} else {
		return false;
	}
	
	// get the latest chats...
	var req = https.request({ hostname: 'slack.com', port: 443, path: '/api/'+which_kind_of_chat+'.history?token='+api_token+'&channel='+group_id+'&oldest='+latest_chat_check, method: 'GET' }, function(res) {
		//console.log('STATUS: ' + res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		var thebody = '';
		res.on('data', function (chunk) {
			//console.log('BODY: ' + chunk);
			thebody += chunk;
		});
		res.on('end', function() {
			//console.log('FULL BODY: ' + thebody);
			// parse the package of latest chats, and if OK, send the history along to parseChats()
			var latest_chats = JSON.parse(thebody);
			if (latest_chats.ok == true) {
				parseChats(latest_chats.messages);
			} else {
				console.log('SLACK ERROR getting latest messages: ' + latest_chats.error);
			}
			
		});
	});
	req.on('error', function(e) {
		console.log('ERROR getting latest messages: ' + e.message);
	});
	req.end();
}

// actually parse the chat messages one at a time
function parseChats(messages) {
	//console.log(messages.length + ' messages to parse through since last check');
	
	// go through chat history, one message at a time
	for (var i in messages) {
	
		// the first one is the latest
		if (i == 0) {
			latest_chat_check = messages[i].ts;
			writeTStoFile(latest_chat_check);
		}
		
		// filter by message type...
		if (messages[i].type != 'message') {
			continue;
		}
		
		// if it has a subtype, we probably do not want it
		if (messages[i].subtype != undefined || messages[i].attachments != undefined) {
			continue;
		}
		
		//console.log(messages[i]);
		//console.log(users[messages[i].user] + ' said: ' + messages[i].text);

		var chatuser = users[messages[i].user].toLowerCase();
		var chatline = messages[i].text;
		
		/*
		
			here begins the giant list of responders!
		
		*/
		
		// if the bot has been shut up, and is told they can talk again, do so
		if ((self_regex.test(chatline) && /you can talk/i.test(chatline)) || chatline.toLowerCase() == '!talk') {
			saySomething('yay! i can talk again!');
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
			saySomething('oh hai '+chatuser, ':smiley_cat:');
			return;
		}
		
		if (/^(bai|bye|goodbye|caio|cya)$/i.test(chatline)) {
			saySomething('lol cya', ':crying_cat_face:');
			return;
		}
		
		if (/^good morning/i.test(chatline)) {
			saySomething('is it morning? i\'ve been here so long...', ':psyduck:');
			return;
		}
		
		if (/^good afternoon/i.test(chatline)) {
			saySomething('oh hello', ':smiley_cat:');
			return;
		}
		
		// generic meme responders....
		
		if (/^i can break these cuffs$/i.test(chatline)) {
			saySomething('You can\'t break those cuffs!', ':cop:');
			return;
		}
		
		if (/death metal/i.test(chatline)) {
			saySomething('oh hell yeah death metal', ':metal:');
			return;
		}
		
		if (/^gimme dat bass$/i.test(chatline)) {
			saySomething('Perchance is someone inquiring for an obsequious selection of that bass?', ':raised_hands:');
			return;
		}
		
		if (/help ?desk/i.test(chatline)) {
			if (rollDie(10) <= 3) {
				saySomething('HERLPDERRSSSSSS', ':information_desk_person:');
				return;
			}
		}
		
		if (/\bnom\b/i.test(chatline)) {
			saySomething('nom nom nom', ':heart_eyes_cat:');
			return;
		}
		
		if (/^hip hip!?$/i.test(chatline)) {
			saySomething('horray!', ':smile_cat:');
			return;
		}
		
		if (/^what /i.test(chatline)) {
			if (rollDie(10) <= 3) {
				saySomething('some people say the cucumbers taste better pickled...', ':smirk_cat:');
				return;
			}
		}
		
		if (/^welp/i.test(chatline)) {
			if (rollDie(10) <= 5) {
				saySomething('you\'re tellin me', ':psyduck:');
				return;
			}
		}
		
		if (/(z|9)/i.test(chatline)) {
			if (rollDie(10) <= 3) {
				saySomething('delicious!', ':sparkling_heart:');
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
			saySomething(wut, ':pouting_cat:');
			return;
		}
			
			
		if (/space jam/i.test(chatline)) {
			saySomething('Everybody get up, it\'s time to slam now! We got a real jam goin down!', ':basketball:');
			setTimeout(function() {
				saySomething('Welcome to the SPACE JAM!', ':rocket:');
			}, Math.round(Math.random() * 1000)+1000);
			return;
		}
		
		if (/^ho+p(!)?$/i.test(chatline)) {
			saySomething('THERE IT IS!', ':raised_hands:');
			return;
		}
		
		if (/^who+mp(!)?$/i.test(chatline)) {
			saySomething('THERE IT IS!', ':raised_hands:');
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
			saySomething(wut, ':notes:');
			return;
		}
		
		// !commands
		
		if (/^!(.+)$/.test(chatline)) {
			
			if (/!commands\b/i.test(chatline)) {
				saySomething('Commands: !lyric, !poem [#], !status, !sentence, !roll [#], !song, !define [word], !fact, !server [hostname], !lastlyric, !lastpoem', ':computer:');
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
							if (filterMsg(lyricobj.line)) {
								saySomething(lyricobj.line, ':notes:');
							}
						} else {
							saySomething('error getting a lyric... sorry...', ':crying_cat_face:');
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
						if (filterMsg(poemobj.line)) {
							saySomething(poemobj.line, ':pencil2:');
						}
					});
				});
				return;
			}
			
			if (/!lastlyric\b/i.test(chatline)) {
				if (lyricobj == undefined) {
					saySomething('there has not been a lyric spoken yet', ':crying_cat_face:');
				} else {
					if (filterMsg(lyricobj.song)) {
						saySomething('the last lyric was from '+lyricobj.artist+' - '+lyricobj.song, ':headphones:');
					} else {
						saySomething('uhhh i don\'t know where the last lyric is from...', ':crying_cat_face:');
					}
				}
				return;
			}
			
			if (/!lastpoem\b/i.test(chatline)) {
				if (poemobj == undefined) {
					saySomething('there has not been a poem spoken yet', ':crying_cat_face:');
				} else {
					saySomething('the last line of poetry was from "'+poemobj.title+'" by '+poemobj.author, ':pencil2:');
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
						if (filterMsg(returned)) {
							saySomething(returned, randomKittyEmoji());
						}
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
						if (filterMsg(returned)) {
							saySomething(returned, randomKittyEmoji());
						}
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
					saySomething(username + ' rolls a '+rollDie(roll_matches[1] * 1), ':game_die:');
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
					saySomething(restext, ':game_die:');
				} else {
					saySomething(username + ' rolls a '+rollDie(6), ':game_die:');
				}
				return;
			}
			
			// define a word!
			if (/^!define (\w+)/i.test(chatline)) {
				var define_pieces = chatline.match(/^!define (\w+)$/i);
				if (define_pieces == undefined || define_pieces[1] == undefined) {
					saySomething("Uhhh I need a word to define...", ':book:');
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
							saySomething("No definition found, sorry!", ':book:');
							return;
						}
						var definetxt = '';
						for (var i in defineobj) {
							definetxt = '' + defineobj[i]['revisions'][0]['*'] + '';
						}
						//console.log(definetxt);
						define_matches = definetxt.match(/# (.+)\n/ig);
						if (define_matches == undefined || define_matches[0] == undefined) {
							saySomething("No definition found, sorry!", ':book:');
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
							saySomething("No definition found, sorry!", ':book:');
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
							saySomething("No definition found, sorry!", ':book:');
							return;
						}
						//console.log('the definition: '+the_definition);
						saySomething(the_definition.trim(), ':book:');
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
							saySomething('Oh crap. Error getting a random fact. Sorry.');
							return;
						}
						var the_fact = fact_matches[1].trim();
						the_fact = the_fact.replace(/\s{2,}/g, ' ');
						the_fact = the_fact.replace(/&rsquo;/gi, "'");
						the_fact = the_fact.replace(/&ldquo;/gi, '"');
						the_fact = the_fact.replace(/&rdquo;/gi, '"');
						saySomething(the_fact, ':interrobang:');
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
						saySomething(returned_stuff, ':notes:');
					});
				});
				return;
			}
			
			// get server status from my Nagios API
			if (/^!server (.+)/i.test(chatline)) {
				var server_pieces = chatline.match(/^!server (.+)$/i);
				if (server_pieces == undefined || server_pieces[1] == undefined) {
					saySomething("Uhhh I need a server to check...", ':satellite:');
					return;
				}
				var theserver = server_pieces[1];
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
						saySomething(what, ':satellite:');
					});
				});
				return;
			}
			
		} // end if ! commands
		
		
		// respond to its name
		
		if (self_regex.test(chatline)) {
			var bot_matches = chatline.match(self_regex);
			var wut = '';
			var said_before = bot_matches[1].toLowerCase();
			var said_after = bot_matches[2].toLowerCase();
			if (/^(.*)how are you(.*)$/i.test(chatline)) {
				http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'status.php'}, function(res) {
					var returned = '';
					res.on('data', function (chunk) {
						returned += ''+chunk+'';
					});
					res.on('end', function() {
						if (filterMsg(returned)) {
							saySomething(returned, randomKittyEmoji());
						}
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
								if (filterMsg(returntext)) {
									saySomething(returntext, randomKittyEmoji());
								}
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
					saySomething(wut, randomKittyEmoji());
					return;
				} else if (roll >= 30 && roll <= 50) {
					wut = 'uh what';
					saySomething(wut, randomKittyEmoji());
					return;
				} else {
					http.get({host: my_home_appserver, port: 80, path: my_home_appserver_path+'sentence.php'}, function(res) {
						var returned = '';
						res.on('data', function(chunk) {
							returned += ''+chunk+'';
						});
						res.on('end', function() {
							returned = chatuser.toLowerCase() + ', ' + returned;
							if (filterMsg(returned)) {
								saySomething(returned, randomKittyEmoji());
							}
						});
					});
					return;
				}
			}
			var roll = rollDie(100);
			if (roll > 60) {
				wut = chatuser.toLowerCase() + ', ' + wut;
			}
			saySomething(wut, randomKittyEmoji());
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
					if (filterMsg(wut)) {
						saySomething(wut, randomKittyEmoji());
					}
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
			saySomething(wut, randomKittyEmoji());
		}
		
		/*
		
			here ends the giant list of responders!
		
		*/
		
	}
}

// get the current list of usernames, add them to the array
// so we can parse their user IDs to proper usernames
//   https://slack.com/api/users.list?token=xxx
function getUsernames() {
	//console.log('updating usernames...');
	var req = https.request({ hostname: 'slack.com', port: 443, path: '/api/users.list?token='+api_token, method: 'GET' }, function(res) {
		//console.log('STATUS: ' + res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		var thebody = '';
		res.on('data', function (chunk) {
			//console.log('BODY: ' + chunk);
			thebody += chunk;
		});
		res.on('end', function() {
			//console.log('FULL BODY: ' + thebody);
			var slack_users = JSON.parse(thebody);
			if (slack_users.ok == true) {
				//console.log(slack_users);
				users = []; // clear old users cache
				// and rebuild it:
				for (var i in slack_users.members) {
					//console.log(slack_users.members[i].id + ' is ' + slack_users.members[i].name);
					users[slack_users.members[i].id] = slack_users.members[i].name;
				}
			} else {
				console.log('SLACK ERROR trying to get users list: ' + slack_users.error);
			}
			
		});
	});
	req.on('error', function(e) {
		console.log('ERROR requesting users list: ' + e.message);
	});
	req.end();
}

// post something to chat!
//   https://slack.com/api/chat.postMessage?token=xxx&channel=xxx&text=xxx&username=xxx&icon_emoji=xxx
function saySomething(message, emoji) {
	if (message == undefined) {
		return false;
	}
	if (emoji == undefined) {
		emoji = ':cat:';
	}

	//console.log('** sending message: ' + message);

	var message_query = qs.stringify({ token: api_token, channel: group_id, username: bot_name, icon_emoji: emoji, text: message });

	var req = https.request({ hostname: 'slack.com', port: 443, path: '/api/chat.postMessage?'+message_query, method: 'GET' }, function(res) {
		//console.log('STATUS: ' + res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		var thebody = '';
		res.on('data', function (chunk) {
			thebody += chunk;
		});
		res.on('end', function() {
			var slack_response = JSON.parse(thebody);
			if (slack_response.ok == true) {
				return true;
			} else {
				console.log('SLACK ERROR sending message: ' + slack_response.error);
				return false;
			}
		});
	});
	req.on('error', function(e) {
		console.log('ERROR sending message: ' + e.message);
	});
	req.end();
}

// this will write the last check out to a file
// so there is some small bit of persistence
function writeTStoFile(the_ts) {
	fs.writeFile(ts_file, the_ts, function(err) {
		if(err) {
			console.log('ERROR writing out to TS file: ' + err);
		} else {
			//console.log("The file was saved!");
		}
	});
}

/*

	ok, start it up!

*/

console.log("starting up "+bot_name+" for slack...");

/*

	persistence functionality explained...

	how this works is that it polls Slack for new messages at 2-second intervals
	however, on first load, it'll get ALL the messages, which is always overkill
	so instead, by default, get just the last minute
	every time it fetches new messages, it saves a timestamp to a file
	if we've already been running this bot, that file will already exist
	so instead of using a minute, use whatever that file says
	unless it's way further back than a minute

*/
// to prevent spam, only start using the last minute of messages on start, by default
latest_chat_check = ((new Date).getTime() / 1000) - 60;
// if ts_file exists, read it
fs.readFile(ts_file, { encoding: 'utf8' }, function (err, data) {
	if (err) {
		// file probably does not exist, that's okay
	} else {
		if (data * 1 > latest_chat_check) {
			latest_chat_check = data;
			console.log('had been monitoring already, using last TS check from file...');
		} else {
			console.log('had been monitoring already, but that was too long ago...');
		}
	}
});

// when starting script, get usernames, then get chats 500ms later
getUsernames();
setTimeout(getLatestChats, 500);

// refresh username list every 5 minutes
var get_usernames = setInterval(getUsernames, (5 * 60 * 1000));

// get latest chats every 2 seconds
var get_latest = setInterval(getLatestChats, (2 * 1000));