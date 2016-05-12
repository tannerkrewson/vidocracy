var socket = io();

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
      'onStateChange': onPlayerStateChange
    }
  });

  //add bootstrap responsive embed to the new player
  $('player').addClass('embed-responsive-item');
}

// autoplay video
function onPlayerReady(event) {
  event.target.playVideo();
}

// when video ends
function onPlayerStateChange(event) {  
  //we are only going to send this if we are the main screen
	//0 means video has ended      
	if($('#admincode').html() !== '' && event.data === 0) {          
    SendToServer.videoEnd();
	}
}

function playVideo(videoId) {
	player.loadVideoById(videoId);
}

//main code

SendToServer.screenConnect();

socket.on('set', function(msg) {
	var qi = msg.queueitem;
	playVideo(qi.typeSpecific.videoID);
})
