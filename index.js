var express = require('express');
var socketio = require('socket.io');
var crypto = require('crypto');
var cookieParser = require('cookie-parser')

var app = express();

//middleware
app.use(cookieParser())

var vidocracy = new PartyManager();

//read the config file
var Config;
try {
    Config = require('./config/user.config');
} catch (e) {
    console.log('Failed to parse user.config.js');
    console.log('');
    console.log('Make sure you copy _template_user.config.js');
    console.log('and rename it to user.config.js if you want');
    console.log('to override the default global config.');
    Config = require('./config/global.config');
}

//make sure the google api key is set
if (Config.googleAPIKey === undefined){
    console.log('Please set a Google API Key in user.config.js');
    console.log('or as process.env.GOOGLEAPIKEY');
    process.exit(1);
}

//make sure the url is set
if (Config.url === undefined){
    console.log('Please set a url in user.config.js');
    console.log('or as process.env.URL');
    process.exit(1);
}

app.set('port', Config.port);

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//if its 80, leave it blank, because browsers do that for you
const vidocracyPort = Config.port === 80 || Config.port === process.env.PORT ? '' : ':' + Config.port;

const vidocracyURL = Config.url + vidocracyPort;

app.get('/host', function(request, response) {
	//create a new party
	var newParty = vidocracy.newParty();

	response.render('pages/host', {
		code: newParty.code,
		adminCode: newParty.adminCode,
		url: {
			party: vidocracyURL + '/party/' + newParty.code,
			adminParty: vidocracyURL + '/party/' + newParty.code + '/admin/' + newParty.adminCode,
			mainScreen: vidocracyURL + '/party/' + newParty.code + '/screen/' + newParty.adminCode,
			userScreen: vidocracyURL + '/party/' + newParty.code + '/screen/'
		}
	});
});

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/join', function(request, response) {
  response.render('pages/join');
});

app.get('/party/:code', function(request, response) {
	var code = request.params.code;
	var party = vidocracy.getParty(code);

	//grab the user's token from their cookies,
	//	will be undefined if it does not exist
	var userToken = request.cookies.token;

	//if party exists
	if (party !== null){
		//this will return the existing user or a new user
    	var thisUser = party.getUser(userToken);

		//set a cookie that will act as the user's login token
        response.cookie('id', thisUser.id, {
            maxAge: 604800000 // Expires in one week
        });

        response.cookie('token', thisUser.token, {
            maxAge: 604800000 // Expires in one week
        });

		response.render('pages/party', {
			code: party.code,
			googleapikey: Config.googleAPIKey,
      url: vidocracyURL
		});
	} else {
		//send them back home
		response.redirect('/');
	}
});

app.get('/party/:code/admin/:admincode', function(request, response) {
	//add the admin code to the users code, and
	//	redirect them to the party page, which
	//	itself will check if the user is admin
	var code = request.params.code;
	var adminCode = request.params.admincode;
	var party = vidocracy.getParty(code);

	//if party exists and the admin code is correct
	if (party !== null && party.adminCode === adminCode){

        response.cookie('admincode', adminCode, {
            maxAge: 604800000 // Expires in one week
        });

        //redirect to party page
        response.redirect('/party/' + code);

	} else {
		//send them back home
		response.redirect('/');
	}
});

//user screens
app.get('/party/:code/screen', function(request, response) {
	var code = request.params.code;
	var party = vidocracy.getParty(code);

	//grab the user's token from their cookies,
	//	will be undefined if it does not exist
	var userToken = request.cookies.screenToken;

	//if party exists
	if (party !== null) {
		//this will return the existing user or a new user
    	var thisScreen = party.getScreen(userToken);

		//set a cookie that will act as the user's login token
        response.cookie('screenid', thisScreen.id, {
            maxAge: 604800000 // Expires in one week
        });

        response.cookie('screentoken', thisScreen.token, {
            maxAge: 604800000 // Expires in one week
        });

		response.render('pages/screen', {
			pageTitle: 'Screen',
			code: party.code,
			admincode: '',
			googleapikey: Config.googleAPIKey,
      url: vidocracyURL
		});
	} else {
		//send them back home
		response.redirect('/');
	}
});

//main screen
app.get('/party/:code/screen/:admincode', function(request, response) {
	var code = request.params.code;
	var adminCode = request.params.admincode;
	var party = vidocracy.getParty(code);

	//we don't need to worry about screenTokens for the main screen
	//	because their can be only one main screen, and it will be
	//	authenticated by the admin code

	//	AND no other main screen is currently connected
	var isAnotherMainScreenNotConnected = (party.mainScreen === null || !party.mainScreen.socket.connected);

	//if party exists and the admin code is correct
	if (party !== null && party.adminCode === adminCode && isAnotherMainScreenNotConnected) {

		response.render('pages/screen', {
			pageTitle: 'Main Screen',
			code: party.code,
			admincode: party.adminCode,
			googleapikey: Config.googleAPIKey,
      url: vidocracyURL
		});
	} else {
		//send them back home
		response.redirect('/');
	}
});

var server = app.listen(app.get('port'), function() {
  console.log('Vidocracy is running on port', app.get('port'));
});

//connect socket.io to the server
var io = socketio.listen(server);

//handles users coming and going
io.on('connection', function(socket) {

	//client will send this when they join a valid party
	socket.on('entrance', function(msg){
		//we now must check that their party is valid
    	//check to see if the party exists
    	var thisParty = vidocracy.getParty(msg.partyCode);

    	//this will return the existing user or a new user
    	var thisUser = thisParty.getUser(msg.user.token);

    	if (thisParty !== null) {

    		//attach the user's socket to their user object
    		thisUser.socket = socket;

    		//send the user the current queue
    		thisParty.sendQueueToUser(thisUser);

		    socket.on('add', function(msg) {
		    	//construct a new QueueItem from the one sent from the server
		    	var qi = msg.data.queueItem;
		    	thisParty.add(new QueueItem(qi.title, qi.type, qi.typeSpecific), msg.user.id);
		    });

		    socket.on('vote', function(msg) {
		    	thisParty.vote(msg.data.queueItemID, msg.user.id);
		    });

		    //now we'll check if this user is a valid admin
		    if (msg.adminCode === thisParty.adminCode) {

		    	//tell the client that it is an admin, so
		    	//	that it can display the admin tools
				socket.emit('admin', null);

				//add the admin only socket listeners
			    socket.on('delete', function(msg) {
			    	thisParty.delete(msg.data.queueItemID);
			    });
		    };
    	}
	});

	//user screen
	socket.on('screenConnect', function(msg) {
		//we now must check that their party is valid
    	//check to see if the party exists
    	var thisParty = vidocracy.getParty(msg.partyCode);

    	//this will return the existing user or a new user
    	var thisUser = thisParty.getScreen(msg.screen.token);

    	if (thisParty !== null) {

    		//attach the user's socket to their user object
    		thisUser.socket = socket;
    	}
	})

	//main screen
	socket.on('mainScreenConnect', function(msg) {
		//we now must check that their party is valid
    	//check to see if the party exists
    	var thisParty = vidocracy.getParty(msg.partyCode);

    	var newMainScreen = new User();

    	//the admin code check has already been done by the express function
    	//	but we check again for security
    	if (thisParty !== null && msg.adminCode === thisParty.adminCode) {

    		//attach this screen's socket to it's user object
    		newMainScreen.socket = socket;

    		//set this as the party's new main screen
    		thisParty.mainScreen = newMainScreen;

    		//send the top video to our new main screen
    		thisParty.queueNextItem();

    		//if the video ends, start the next one
		    socket.on('videoEnd', function(msg) {
		    	thisParty.queueNextItem();
		    });
    	}
	})

});


function PartyManager() {
	this.partys = [];
}

PartyManager.prototype.newParty = function(){
	var newParty = new Party(this.getUniqueCode());
	this.partys.push(newParty);
	return newParty;
}

PartyManager.prototype.getUniqueCode = function(){
	var code;
	var isUnique;
	do {
		isUnique = true;
		code = fiveRandomLetters();
		//compare generated code to each existing code
		for (var i = this.partys.length - 1; i >= 0; i--) {
			if (this.partys[i].code === code){
				isUnique = false;
				break;
			}
		}
	}
	while(!isUnique);

	return code;
}

PartyManager.prototype.getParty = function(code){
	for (var i = this.partys.length - 1; i >= 0; i--) {
		if (this.partys[i].code === code){
			return this.partys[i];
		}
	}
	//party does not exist
	return null;
}


function Party(uniqueCode) {
	this.code = uniqueCode;

	//does not need to be unique, so we can generate it right here
	this.adminCode = fiveRandomLetters();

	this.queue = [];
	this.users = [];
	this.screens = [];

	this.mainScreen = null;

	//this signifies that nothing is playing
	this.nowPlaying = new QueueItem('','empty','');
}

Party.prototype.vote = function(queueItemID, userID) {
	var tempQI = this.getQueueItem(queueItemID);
	if(tempQI !== null){
		tempQI.toggleVote(userID);
	}

	//remove the item from the queue if the vote count
	//	drops to zero, meaning the person who added
	//	it un-upvoted it.
	if (tempQI.votes < 1) {
		//remove it
		var index = this.queue.indexOf(tempQI);
		if (index > -1) {
		    this.queue.splice(index, 1);
		}
	}

	this.sortQueue();

	this.sendQueueToAll();
}

Party.prototype.add = function(queueItem, userID) {
	this.queue.push(queueItem);
	console.log(queueItem.title + ' has been queued');

	//user automatically votes for the item they added
	this.vote(queueItem.id, userID);
	this.sortQueue();

	//send the new queue to all of the users
	this.sendQueueToAll();
}

Party.prototype.delete = function(queueItemID) {
	var tempQI = this.getQueueItem(queueItemID);
	if(tempQI !== null){
		//remove it
		var index = this.queue.indexOf(tempQI);
		if (index > -1) {
		    this.queue.splice(index, 1);
		}
	}

	this.sortQueue();

	this.sendQueueToAll();
}

Party.prototype.sortQueue = function() {
	//sorts by greatest to least number of votes
	this.queue.sort(function(a, b) {
		if (a.votes > b.votes) {
			return -1;
		} else if (a.votes < b.votes) {
			return 1;
		} else {
			return 0;
		}
	});

	//make sure now playing is not empty
	if (this.nowPlaying.type === 'empty') {
		this.queueNextItem();
	}
}

Party.prototype.getQueueItem = function(queueItemID) {
	for (var i = this.queue.length - 1; i >= 0; i--) {
		if (this.queue[i].id === queueItemID){
			return this.queue[i];
		}
	}
	//queueitem does not exist
	return null;
}

//if the user already exists, it will return that one,
//	otherwise it will create a new user and return that.
Party.prototype.getUser = function(userToken){
	for (var i = this.users.length - 1; i >= 0; i--) {
		if (this.users[i].token === userToken){
			return this.users[i];
		}
	}

	//user does not exist, so lets make a new one
	var newUser = new User();
	this.users.push(newUser);
	return newUser;
}

//if the user already exists, it will return that one,
//	otherwise it will create a new user and return that.
Party.prototype.getScreen = function(screenToken){
	for (var i = this.screens.length - 1; i >= 0; i--) {
		if (this.screens[i].token === screenToken){
			return this.screens[i];
		}
	}

	//user does not exist, so lets make a new one
	//screens are just special users
	var newUser = new User();
	this.screens.push(newUser);
	return newUser;
}

Party.prototype.sendVideoToScreens = function(queueItem) {
	//first, send it to the main screen, if it is connected
	if (this.mainScreen !== null && this.mainScreen.socket.connected) {
		this.sendVideoToScreen(queueItem, this.mainScreen);
	};

	//and finally send it to all the other screens
	for (var i = this.screens.length - 1; i >= 0; i--) {
		this.sendVideoToScreen(queueItem, this.screens[i]);
	};
}

Party.prototype.sendVideoToScreen = function(queueItem, screenUser) {
	var userSocket = screenUser.socket;

	//check to make sure that the screen is online
	if(userSocket.connected) {
		var data = {
			queueitem: queueItem
		}
		userSocket.emit('set', data);
	}
}

Party.prototype.sendQueueToAll = function() {
	for (var i = this.users.length - 1; i >= 0; i--) {
		this.sendQueueToUser(this.users[i]);
	}
}

//does NOT check to see if the user exists in this party
Party.prototype.sendQueueToUser = function(user) {
	var userSocket = user.socket;

	//check to make sure that the user is online
	if(userSocket.connected) {
		var data = {
			queue: this.queue,
			nowPlaying: this.nowPlaying
		}
		userSocket.emit('queue', data);
	}
}

Party.prototype.queueNextItem = function() {

	var isMainScreenConnected = (this.mainScreen !== null && this.mainScreen.socket.connected);

	//if the queue is not empty and a main screen is connected
	if (this.queue.length > 0 && isMainScreenConnected) {
		//set now playing to the next in the queue
		this.nowPlaying = this.queue[0];

		//remove now playing from the queue
		this.queue.splice(0, 1);

		//tell the screens to play the video
		this.sendVideoToScreens(this.nowPlaying);

		//send the updated queue to everybody
		this.sendQueueToAll();
	} else {
		this.nowPlaying = new QueueItem('','empty','');
	}

}


function QueueItem(title, type, typeSpecific) {
	this.id = twentyRandomCharacters();
	this.votes = 0;
	this.votedBy = [];

	this.title = title;
	this.type = type;
	this.typeSpecific = typeSpecific;
}

QueueItem.prototype.toggleVote = function(userID) {
	//if the user has not upvoted already
    var hasAlreadyVoted = false;
    for (var i = this.votedBy.length - 1; i >= 0; i--) {
        if (this.votedBy[i] === userID) {
            hasAlreadyVoted = true;
            break;
        }
    };
	if (!hasAlreadyVoted) {
		this.votes++;
		//add the user to the list of users who have upvoted
		this.votedBy.push(userID);
	} else {
		this.votes--;
		//remove the user from the voted list
		var upVoteIndex = this.votedBy.indexOf(userID);
		this.votedBy.splice(upVoteIndex, 1);
	}
}



function User() {
	//id is meant to be public and can be sent to all clients
	this.id = twentyRandomCharacters();

	//token should be kept private between the corresponding user
	//	and the server, and should never be sent to any other users
	this.token = twentyRandomCharacters();

	//this should be added manually, this line is just here for reference
	this.socket;
}


function fiveRandomLetters() {
	var text = "";
    var possible = "abcdefghijklmnopqrstuvwxyz";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function twentyRandomCharacters() {
	return crypto.randomBytes(20).toString('hex');
}
