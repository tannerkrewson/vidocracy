var express = require('express');
var app = express();

var utoble = new TobleManager();

app.set('port', (process.env.PORT || 5000));

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
		code: toble.code
	});
	} else {
		//send them back home
		response.redirect('/');
	}
});

app.get('/toble/:code/admin/:admincode', function(request, response) {
	console.log(request.params.code + ' ' + request.params.admincode);
});

app.listen(app.get('port'), function() {
  console.log('Utoble is running on port', app.get('port'));
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
}

function fiveRandomLetters() {
	var text = "";
    var possible = "abcdefghijklmnopqrstuvwxyz";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}
