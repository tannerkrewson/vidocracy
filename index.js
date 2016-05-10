var express = require('express');
var socketio = require('socket.io');
var app = express();

var utoble = new TobleManager();

//read the config file
var Config;
try {
    var Config = require('./config/user.config');
} catch (e) {
    console.log('Failed to parse user.config.js');
    console.log('Make sure you copy _template_user.config.js');
    console.log('and rename it to user.config.js');
    process.exit(1);
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

	//if toble exists
	if (toble !== null){
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

	sessionArray = socket.handshake.headers.cookie.split(" ");
	sessionID = sessionArray[0].split("express.sid=").pop();

	if(sessionIDs.indexOf(sessionID) > -1) {
	   io.sockets.socket(socket.id).emit('preventlogin', true);
	}
	else {
	   sessionIDs.push(sessionID);
	   // and do the rest
	}
    socket.on('add', function(msg) {

    	//check to see if the toble exists
    	var thisToble = utoble.getToble(msg.tobleCode);

    	if(thisToble !== null) {
    		thisToble.queue(msg.queueItem);
    	}
    });

    socket.on('upvote', function(msg) {

    	//check to see if the toble exists
    	var thisToble = utoble.getToble(msg.tobleCode);

    	if(thisToble !== null) {
    		//thisToble.upvote();
    	}
    });

    socket.on('disconnect', function() {
    	//do something
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
}

Toble.prototype.queue = function(queueItem) {
	this.queue.add(queueItem);
}

Toble.prototype.vote = function(queueItemID, user) {
	//TODO: if the user is valid
	if (true) {
		var tempQI = this.getQueueItem(queueItemID);
		tempQI.toggleVote(user);
	}
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


function QueueItem(qi) {
	//this.id = ;
	this.title = qi.title;
	this.votes = 0;
	this.votedBy = [];
}

QueueItem.prototype.toggleVote = function(user) {
	//if the user has not upvoted already
    var hasAlreadyVoted = false;
    for (var i = this.votedBy.length - 1; i >= 0; i--) {
        if (this.votedBy[i].unique === user.unique) {
            hasAlreadyVoted = true;
            break;
        }
    };
	if (!hasAlreadyVoted) {
		this.votes++;
		//add the user to the list of users who have upvoted
		this.votedBy.push(user);
	} else {
		this.votes--;
		//remove the user from the voted list
		var upVoteIndex = this.votedBy.indexOf(user);
		this.votedBy.splice(upVoteIndex, 1);
	}
}


YouTubeQueueItem.prototype = Object.create(QueueItem.prototype);

function YouTubeQueueItem(qi) {
	QueueItem.call(qi);

	this.videoID = qi.videoID;
}


function fiveRandomLetters() {
	var text = "";
    var possible = "abcdefghijklmnopqrstuvwxyz";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}
