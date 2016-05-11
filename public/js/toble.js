var socket = io();

var ytSearch = new Search();

ytSearch.query = function(query) {
//sends the API request, and executes a function
//  when the results come back
  var request = gapi.client.youtube.search.list({
    q: query,
    part: 'snippet'
  });

  request.execute(function(response) {
    var results = response.result.items;

    //construct a qi array from the results
    //  the mock QI is used for the constructor of
    //  the actual QI
    var queueItemArray = [];
    for (var i = 0; i < results.length; i++) {
      var mockQI = {
        title: results[i].snippet.title,
        videoID: results[i].id.videoId
      }

      var realQI = new YouTubeQueueItem(mockQI);
      queueItemArray.push(realQI);
    }

    Search.displayResults(queueItemArray);
  });
}


function SendToServer() {}

SendToServer.generic = function(event, data){
    socket.emit(event, {
        tobleCode: $('#toblecode').html(),
        user: {
          id: Cookies.get('id'),
          token: Cookies.get('token')
        },
        data: data
    });
}

//should be called at page load
SendToServer.entrance = function(){
  SendToServer.generic('entrance', null);
}

//add a video or song to the queue
SendToServer.add = function(queueItem) {
  var data = {
    queueItem: queueItem
  }
  SendToServer.generic('add', data);
}


function Search() {
  this.results = [];
}

//should call Search.displayResults
Search.prototype.query = function(query) {}

Search.displayResults = function(arrayOfQueueItems) {
  Search.clearSearchResults();
  for (var i = arrayOfQueueItems.length - 1; i >= 0; i--) {
    Search.addSeachResult(arrayOfQueueItems[i]);
  }
}

Search.addSeachResult = function(queueItem) {
  var resultHTML = '<div class="list-group-item">' + queueItem.title + '<button type="button" class="btn btn-sm add btn-primary">Add</button></div>';
  var result = $('#searchresults').prepend(resultHTML);

  //first will give us the Add button we just made,
  //  so we can hook up logic to it
  var button = result.first();

  //when this add button is clicked
  button.on('click', function(event) {
    SendToServer.add(queueItem);
  });
}

Search.clearSearchResults = function() {
  $('#searchresults').empty();
}


function QueueItem(qi) {
  this.title = qi.title;
}


YouTubeQueueItem.prototype = Object.create(QueueItem.prototype);

function YouTubeQueueItem(qi) {
  QueueItem.call(this, qi);
  this.videoID = qi.videoID;
}




/*
  YouTube Search
*/

//ran when Google's client.js loads
function initializeYoutubeAPI() {
  var key = $('#googleapikey').html();
  gapi.client.setApiKey(key);
  gapi.client.load('youtube', 'v3');
}

//ran when the user starts typing in the search box
//  is ran for every keystroke
$('#searchinput').on('keyup', function() {
  if (this.value.length > 1) {
    ytSearch.query(this.value);
  }
});


//Main Code

SendToServer.entrance();
