var socket = io();

var waitingMessage = $('#waitingmessage');

function SendToServer() {}

SendToServer.generic = function(event, data){
    socket.emit(event, {
        tobleCode: $('#toblecode').html(),
        adminCode: $('#admincode').html(),
        screen: {
    			id: Cookies.get('screenid'),
    			token: Cookies.get('screentoken')
        },
        data: data
    });
    /*  Note about the above, if the page was loaded as a
        main screen, id and token above will not used in
        checks by the server, but if it was loaded as a
        user screen, adminCode won't be used.
    */
}

//should be called at page load
SendToServer.screenConnect = function(){
  //the admincode div is only filled if the page was
  //  loaded as a main screen
  if ($('#admincode').html() !== ''){
    SendToServer.generic('mainScreenConnect', null);
  } else {
    SendToServer.generic('screenConnect', null);
  }
}

SendToServer.videoEnd = function() {
  if ($('#admincode').html() !== ''){
    SendToServer.generic('videoEnd', null);
  } 
}

// create youtube player
var player;
function onYouTubePlayerAPIReady() {
  player = new YT.Player('player', {
    videoId: '',
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });

  //add bootstrap responsive embed to the new player
  $('#player').addClass('embed-responsive-item');

  //hide the player by default
  $('#player').hide();
}

// called when the youtube player is finished loading
function onPlayerReady(event) {
  //autoplay video
  //event.target.playVideo();

  //wait until the youtube player has initialized until connecting
  //  to the server to prevent it from sending the video before
  //  it is loaded and ready to play
  SendToServer.screenConnect();

  socket.on('set', function(msg) {
    var qi = msg.queueitem;

    //hide the waiting message
    waitingMessage.hide();

    //unhide the youtube player
    $('#player').show();

    playVideo(qi.typeSpecific.videoID);
  })
}

// when video ends
function onPlayerStateChange(event) {  
  //we are only going to send this if we are the main screen
	//0 means video has ended      
	if($('#admincode').html() !== '' && event.data === 0) {

    //show the waiting message
    waitingMessage.show();

    //hide the youtube player
    $('#player').hide();

    //tell the server to play the next video
    SendToServer.videoEnd();
	}
}

// if the video causes an error
function onPlayerError(event) {  
  //we are only going to send this if we are the main screen
  //i am not checking the error number b/c the type of
  //  error doesn't matter, we're just going to ask for the
  //  next video  
  if($('#admincode').html() !== '') {

    //show the waiting message
    waitingMessage.show();

    //hide the youtube player
    $('#player').hide();

    //tell the server to play the next video
    SendToServer.videoEnd();
  }
}

function playVideo(videoId) {
	player.loadVideoById(videoId);
}