var socket = io();

var ytSearch = new Search();

var isAdmin = false;

ytSearch.query = function(query) {
//sends the API request, and executes a function
//  when the results come back
  var request = gapi.client.youtube.search.list({
    q: query,
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true'
  });

  request.execute(function(response) {
    var results = response.result.items;

    //construct a qi array from the results
    //  the mock QI is used for the constructor of
    //  the actual QI
    var queueItemArray = [];
    for (var i = 0; i < results.length; i++) {
      var tempQI = {
        title: results[i].snippet.title,
        type: 'youtube',
        typeSpecific: {
          videoID: results[i].id.videoId
        }
      }

      queueItemArray.push(tempQI);
    }

    Search.displayResults(queueItemArray);
  });
}


function SendToServer() {}

SendToServer.generic = function(event, data){
    socket.emit(event, {
        partyCode: $('#partycode').html(),
        adminCode: Cookies.get('admincode'),
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

//vote on an item
SendToServer.vote = function(queueItem) {
  var data = {
    queueItemID: queueItem.id
  }
  SendToServer.generic('vote', data);
}


//Admin Only Commands:

//delete an item
SendToServer.delete = function(queueItem) {
  var data = {
    queueItemID: queueItem.id
  }
  SendToServer.generic('delete', data);
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
  //this id is just for the search results, and serves
  //  only to help with the add button
  var id;
  //this loop is so that a duplicate id is not generated
  //do until there is no other element with the same id
  do {
    //the random int simple servers to differentiate the 5 results
    id = 'queueItemAddButton-' + (Math.floor(Math.random() * (99 - 10)) + 10);
  } while($('#' + id).length !== 0);
  
  var resultHTML = '<div class="list-group-item">' + queueItem.title + '<button type="button" class="btn btn-sm add btn-primary" id="' + id + '">Add</button></div>';
  var result = $('#searchresults').prepend(resultHTML);

  //first will give us the Add button we just made,
  //  so we can hook up logic to it
  var button = result.find('#' + id);

  //when this add button is clicked
  // http://stackoverflow.com/questions/1451009/javascript-infamous-loop-issue
  (function(qi) {
    button.on('click', function(event) {
      Search.clearSearchResults();

      //clears the search box
      $('#searchinput').val('');
      
      SendToServer.add(qi);
    });
  })(queueItem);
}

Search.clearSearchResults = function() {
  $('#searchresults').empty();
}


function Queue() {
  this.nowPlaying;
  this.queue = [];
}

Queue.prototype.populateQueue = function(newQueue) {
  this.queue = newQueue;
}

//pass the queue item that is in the now playing slot in the server
Queue.prototype.setNowPlaying = function(np) {
  this.nowPlaying = np;
}

Queue.prototype.displayQueue = function() {
  Queue.clearQueueElement();
  for (var i = this.queue.length - 1; i >= 0; i--) {
    Queue.displayQueueItem(this.queue[i]);
  }

  //fill now playing bar
  var nowPlaying = $('#nowplaying');
  nowPlaying.find('.title').html('Now Playing: ' + this.nowPlaying.title);
  nowPlaying.find('.votecount').html(this.nowPlaying.votes);
}

Queue.displayQueueItem = function(queueItem) {

  //first we need to find out if our client has
  //  upvoted this particular queue item so that
  //  we can change the color and text of the
  //  button accordingly using the .votedBy
  //  included in the queueitem from the server
  var thisUserID = Cookies.get('id');

  //will be -1 if not found
  var index = jQuery.inArray(thisUserID, queueItem.votedBy)

  var buttonText;
  var buttonClass;

  //if user has not upvoted this
  if (index === -1) {
    buttonText = 'Upvote';
    buttonClass = 'btn-primary';
  } else {
    buttonText = 'Upvoted';
    buttonClass = 'btn-info';
  }

  var resultHTML = '<div class="list-group-item clearfix queueitem" id="'
    + queueItem.id + '">'
    + queueItem.title
    + '<button type="button" class="btn btn-sm qiBtn upvote '
    + buttonClass + '"> '
    + buttonText + ' </button> <span class="badge votecount">'
    + queueItem.votes + '</span>';

  $('#queue').prepend(resultHTML);

  var result = $('#' + queueItem.id);

  //first will give us the Add button we just made,
  //  so we can hook up logic to it
  var button = result.find('.upvote');

  //when this add button is clicked
  // http://stackoverflow.com/questions/1451009/javascript-infamous-loop-issue
  (function(qi) {
    button.on('click', function(event) {
      SendToServer.vote(qi);
    });
  })(queueItem);

  //If the user is admin, we'll add the delete button.
  //Note that the user could fake this through a
  //  console command, however because the server checks
  //  each command sent for authenticity, clicking the
  //  the button will do nothing.
  if (isAdmin) {
    var delButHTML = '<button type="button" class="btn btn-sm btn-danger qiBtn delete">Delete</button>';

    //delete button comes before the upvote button
    button.before(delButHTML);
    var delBut = result.find('.delete');

    (function(qi) {
      delBut.on('click', function(event) {
        SendToServer.delete(qi);
      });
    })(queueItem);

  };
}

//does NOT clear the queue array, just the div
Queue.clearQueueElement = function() {
  $('#queue').empty();
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

var partyQueue = new Queue();

SendToServer.entrance();

socket.on('queue', function(msg) {
  partyQueue.populateQueue(msg.queue);
  partyQueue.setNowPlaying(msg.nowPlaying);

  partyQueue.displayQueue();
});

//this will be sent if the server determines that this
//  user is a valid admin for this party
socket.on('admin', function(msg) {
  console.log('Admin Code: ' + Cookies.get('admincode'))
  isAdmin = true;

  //visual cue that this page is an admin page
  $('#subtitle h1').html('Your Party (Admin)');

  //we do this so that the admin tools will show up on the queue
  //  otherwise they won't show up until the queue is displayed
  //  again
  partyQueue.displayQueue();
});

