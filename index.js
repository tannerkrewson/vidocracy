var express = require('express');
var socketio = require('socket.io');
var crypto = require('crypto');
var cookieParser = require('cookie-parser')

var app = express();

//middleware
app.use(cookieParser())

var utoble = new TobleManager();

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
    console.log('No Google API Key set');
    process.exit(1);
}

app.set('port', Config.port);

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/host', function(request, response) {
	//create a new toble
	var newToble = utoble.newToble();

	response.render('pages/host', {
		code: newToble.code,
		adminCode: newToble.adminCode
	});
});

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/join', function(request, response) {
  response.render('pages/join');
});

app.get('/toble/:code', function(request, response) {
	var code = request.params.code;
	var toble = utoble.getToble(code);

	//grab the user's token from their cookies,
	//	will be undefined if it does not exist
	var userToken = request.cookies.token;

	//if toble exists
	if (toble !== null){
		//this will return the existing user or a new user
    	var thisUser = toble.getUser(userToken);

		//set a cookie that will act as the user's login token
        response.cookie('id', thisUser.id, {
            maxAge: 604800000 // Expires in one week
        });

        response.cookie('token', thisUser.token, {
            maxAge: 604800000 // Expires in one week
        });

		response.render('pages/toble', {
			code: toble.code,
			googleapikey: Config.googleAPIKey
		});
	} else {
		//send them back home
		response.redirect('/');
	}
});

app.get('/toble/:code/admin/:admincode', function(request, response) {
	console.log(request.params.code + ' ' + request.params.admincode);
});

var server = app.listen(app.get('port'), function() {
  console.log('Utoble is running on port', app.get('port'));
});

//connect socket.io to the server
var io = socketio.listen(server);

//handles users coming and going
io.on('connection', function(socket) {

	//client will send this when they join a valid toble
	socket.on('entrance', function(msg){
		//we now must check that their toble is valid
    	//check to see if the toble exists
    	var thisToble = utoble.getToble(msg.tobleCode);

    	//this will return the existing user or a new user
    	var thisUser = thisToble.getUser(msg.user.token);

    	if (thisToble !== null) {

    		//attach the user's socket to their user object
    		thisUser.socket = socket;

    		//send the user the current queue
    		thisToble.sendQueueToUser(thisUser);

		    socket.on('add', function(msg) {
		    	//construct a new QueueItem from the one sent from the server
		    	var qi = msg.data.queueItem;
		    	thisToble.add(new QueueItem(qi.title, qi.type, qi.typeSpecific));
		    });

		    socket.on('vote', function(msg) {
		    	thisToble.vote(msg.data.queueItemID, msg.user.id);
		    });
    	}
	});

});


function TobleManager() {
	this.tobles = [];
}

TobleManager.prototype.newToble = function(){
	var newToble = new Toble(this.getUniqueCode());
	this.tobles.push(newToble);
	return newToble;
}

TobleManager.prototype.getUniqueCode = function(){
	var code;
	var isUnique;
	do {
		isUnique = true;
		code = fiveRandomLetters();
		//compare generated code to each existing code
		for (var i = this.tobles.length - 1; i >= 0; i--) {
			if (this.tobles[i].code === code){
				isUnique = false;
				break;
			}
		}
	}
	while(!isUnique);

	return code;
}

TobleManager.prototype.getToble = function(code){
	for (var i = this.tobles.length - 1; i >= 0; i--) {
		if (this.tobles[i].code === code){
			return this.tobles[i];
		}
	}
	//toble does not exist
	return null;
}


function Toble(uniqueCode) {
	this.code = uniqueCode;

	//does not need to be unique, so we can generate it right here
	this.adminCode = fiveRandomLetters();

	this.queue = [];
	this.users = [];
}

Toble.prototype.vote = function(queueItemID, userID) {
	var tempQI = this.getQueueItem(queueItemID);
	if(tempQI !== null){
		tempQI.toggleVote(userID);
	}

	this.sendQueueToAll();
}

Toble.prototype.add = function(queueItem) {
	this.queue.push(queueItem);
	console.log(queueItem.title + ' has been queued');

	//send the new queue to all of the users
	this.sendQueueToAll();
}

Toble.prototype.getQueueItem = function(queueItemID) {
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
Toble.prototype.getUser = function(userToken){
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

Toble.prototype.sendQueueToAll = function() {
	for (var i = this.users.length - 1; i >= 0; i--) {
		this.sendQueueToUser(this.users[i]);
	}
}

//does NOT check to see if the user exists in this toble
Toble.prototype.sendQueueToUser = function(user) {
	var userSocket = user.socket;

	//check to make sure that the user is online
	if(userSocket.connected) {
		userSocket.emit('queue', this.queue);
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
