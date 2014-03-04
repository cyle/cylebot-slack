/*

	cylebot for slack config file
	
	you can run multiple instances of cylebot as long as
	this config is different for each, especially different
	last_check_files, or they may confuse each other...
	
	not the prettiest way to do a config file, but it works

*/

// what do you want the bot called?
exports.bot_name = 'cylebot';

// your API token here
exports.api_token = 'xxx-xxx-xxx-xxx';

// the channel or private group the bot will monitor
exports.group_id = 'C123456789';

// a unique filename (relative or absolute path) which will
// hold onto the latest check timestamp
exports.last_check_file = './last_check_ts';

// these are the potential emoji the bot will use as its icon sometimes
exports.kitties = [ ':smile_cat:', ':joy_cat:', ':smiley_cat:', ':heart_eyes_cat:', ':smirk_cat:', ':kissing_cat:', ':pouting_cat:', ':crying_cat_face:', ':scream_cat:' ];

// names that'll be useful to know for certain responders
exports.my_father = 'cyle';
exports.my_mother = 'molly';
exports.my_spouse = 'hana';

// things to call the bot's spouse!
exports.petnames = [ 'honey', 'babe', 'baby', 'sweetheart', 'sugar bumps', 'angel', 'pumpkinpie', 'honey nut cheerios' ];

// a list of inappropriate words to never let cylebot say
// i'll let you fill this array with bad words
exports.innappropriate = [ ];

// this is where various utilities will live that cylebot's commands rely on
// you may want to remove this functionality entirely
// as i haven't released all of the source code for all of them
exports.my_home_appserver = 'your-app-server.com';
exports.my_home_appserver_path = '/cylebot/';
exports.my_home_nagiosserver = 'your-nagios-proxy-server.com';
exports.my_home_musicserver = 'your-home-music-server.com';