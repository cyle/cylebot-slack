/*

	cylebot for slack config file
	
	you can run multiple instances of cylebot as long as
	this config is different for each, especially different
	last_check_files, or they may confuse each other...
	
	not the prettiest way to do a config file, but it works

*/

module.exports = {
	
	// the API token for the bot
	api_token: 'xxx',
	
	// Slack ID of home channel/group, i.e. G123456
	home_channel: 'xxx',
	
	// what do you want the bot called?
	bot_name: 'cylebot',
	
	// these are the potential emoji the bot will use sometimes
	kitties: [ ':smile_cat:', ':joy_cat:', ':smiley_cat:', ':heart_eyes_cat:', ':smirk_cat:', ':kissing_cat:', ':pouting_cat:', ':crying_cat_face:', ':scream_cat:' ],

	// names that'll be useful to know for certain responders
	my_father: 'cyle',
	my_mother: 'molly',
	my_spouse: 'hana',

	// things to call the bot's spouse!
	petnames: [ 'honey', 'babe', 'baby', 'sweetheart', 'sugar bumps', 'angel', 'pumpkinpie', 'honey nut cheerios' ],

	// a list of inappropriate words to never let cylebot say
	// i'll let you fill this array with bad words
	innappropriate: [ ],

	// this is where various utilities will live that cylebot's commands rely on
	// you may want to remove this functionality entirely
	// as i haven't released all of the source code for all of them
	my_home_appserver: 'your-app-server.com',
	my_home_appserver_path: '/cylebot/',
	my_home_nagiosserver: 'your-nagios-proxy-server.com',
	my_home_musicserver: 'your-home-music-server.com',
	
	// these set up how often cylebot may randomly talk
	random_talk_enabled: false, // does cylebot randomly chatter on his own every once in awhile?
	random_talk_interval: 60 * 1000, // in milliseconds
	random_talk_wait: 5 * 60, // in seconds
	random_chatter_odds_ceiling: 200, // the "odds ceiling" of how often he'll randomly talk on his own. the higher this is, the less likely it is to happen.
	
}
