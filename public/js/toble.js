var socket = io();

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
    searchYoutube(this.value);
  }
});

//sends the API request, and executes a function
//  when the results come back
function searchYoutube(query) {
  var request = gapi.client.youtube.search.list({
    q: query,
    part: 'snippet'
  });

  request.execute(function(response) {
    displayYoutubeResults(response.result);
  });
}

function displayYoutubeResults(results){
  clearSearchResults();
  for (var i = results.items.length - 1; i >= 0; i--) {
    var title = results.items[i].snippet.title;
    var link = 'https://www.youtube.com/watch?v=' + results.items[i].id.videoId;
    addSeachResult(title, link);
  }
}

function addSeachResult(text, url) {
  var resultHTML = '<a href="' + url + '" class="list-group-item">' + text + '<button type="button" class="btn btn-sm add btn-primary">Add</button></a>';
  $('#searchresults').prepend(resultHTML);
}

function clearSearchResults() {
  $('#searchresults').empty();
}