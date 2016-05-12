var socket = io();

function SendToServer() {}

SendToServer.generic = function(event, data){
    socket.emit(event, {
        tobleCode: $('#toblecode').html(),
        screen: {
			id: Cookies.get('screenid'),
			token: Cookies.get('screentoken')
        },
        data: data
    });
}

//should be called at page load
SendToServer.screenConnect = function(){
  SendToServer.generic('screenConnect', null);
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
	//0 means video has ended      
	if(event.data === 0) {          
	  //do something
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
