/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var AWS = require('aws-sdk');


//const URL_ADDRESS = "192.168.1.3";
//const URL_ADDRESS = "localhost";
//const URL_ADDRESS = "spotify-partybox.herokuapp.com";
const URL_ADDRESS = "www.jukibox.com";
const PORT = 8888;

var client_id = 'a00ebad9444f4848b35b79bb9f225cbd'; // Your client id
var client_secret = 'b216eba609be4c0fb0148c678732fc98'; // Your secret
//var redirect_uri = 'http://' + URL_ADDRESS + ":" + PORT + '/callback'; // Your redirect uri
var redirect_uri = 'http://' + URL_ADDRESS + '/callback'; // Your redirect uri
var token_arr = new Array();
var party_code_arr = new Array();
var email_list = new Array();
var user_ids = new Array();
var playlist_ids = new Array();

//var apigateway = new AWS.APIGateway({apiVersion: '2015-07-09'});
const AWSURL = 'https://wxlpdhs2th.execute-api.us-east-1.amazonaws.com/jukibox';


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

// setup to receive json posts
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('port', (process.env.PORT || PORT));

app.use(express.static(__dirname + '/public'))
  .use(cookieParser());

function hostLoginPromise(options) {
  return new Promise(function (resolve, reject) {
    request.get(options, function (error, response, body) {
      if (error) {
        reject(error);
      }
      //console.log(body)
      resolve({ 'email': body.email, 'id': body.id });
    })
  });
}

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      var party_code = generateRandomString(4);
      var user_id = "";
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        hostLoginPromise(options).then(function (data) {
          var current_index = email_list.indexOf(data.email);
          if (current_index === -1) {
            var postBody = {
              url: AWSURL + '/parties',
              headers: {'content-type': 'application/json'},
              body: { "partyCode": party_code, "host": data.id }
            }
            request.post({
              postBody
            }, function(error, response, body){
              console.log(response);
            })
            party_code_arr[party_code_arr.length] = party_code;
            token_arr[token_arr.length] = access_token;
            email_list[email_list.length] = data.email;
            user_ids[user_ids.length] = data.id;
            createPlaylist(party_code)
          }
          else {
            party_code = party_code_arr[current_index];
            access_token = token_arr[current_index];
          }
          console.log(data.id + " created a party with code: " + party_code)
          res.cookie("pc", party_code);
          res.cookie("id", data.id)
          res.redirect('/host.html');
        }).catch(function (err) {
          console.log("ERROR: ", err);
        });

      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token,
      });
    }
  });
});

app.post('/join-party', function (request, response) {
  console.log('Request to join party: ' + request.body.pc)
  let access_token_index = partyCodeExists(request.body.pc)
  if (access_token_index >= 0) {
    response.cookie("at", token_arr[access_token_index])
    response.sendStatus(200)
    console.log("Good Party Code")
  }
  else {
    response.sendStatus(400)
    console.log("Bad Party Code")
  }
})

function partyCodeExists(code) {
  for (let i = 0; i < party_code_arr.length; i++) {
    console.log(code + ":" + party_code_arr[i])
    if (code.toUpperCase() === party_code_arr[i].toUpperCase())
      return i;
  }
  return -1
}

function createPlaylist(pc) {
  let index = partyCodeExists(pc)
  let at = token_arr[index]
  let userID = user_ids[index]
  console.log("Create playlist request for user: " + userID)
  var authOptions = {
    url: 'https://api.spotify.com/v1/users/' + userID + '/playlists',
    body: JSON.stringify({
      'name': pc,
      'description': 'Jukibox playlist',
      'public': false
    }),
    dataType: 'json',
    headers: {
      'Authorization': 'Bearer ' + at,
      'Content-Type': 'application/json'
    },
    //json: true
  };
  playlistIDPromise(authOptions).then(function (data) {
    console.log(data.id)
    playlist_ids[index] = data.id
  })
};

app.post('/fetch-playlist', function (req, res) {
  console.log('Attempt to fetch playlist')
  let index = partyCodeExists(req.body.pc)
  if (index < 0) {
    console.log('Party code did not exist')
    res.sendStatus(404)
  }
  else {
    console.log("Party code found")
    let at = token_arr[index]
    let userID = user_ids[index]
    let playlistID = playlist_ids[index]
    console.log(playlistID)
    var options = {
      url: 'https://api.spotify.com/v1/users/' + userID + '/playlists/' + playlistID,
      dataType: 'json',
      headers: {
        'Authorization': 'Bearer ' + at,
        'Content-Type': 'application/json'
      },
      json: true
    }
    request.get(options, function (error, response, body) {
      console.log(body.tracks)
      try {
        if (!error && (body.tracks.items.length > 0)) {
          let playlistArtists = new Array()
          let playlistSongs = new Array()
          let playlistImages = Array()
          for (let i = 0; i < body.tracks.items.length; i++) {
            playlistArtists[i] = body.tracks.items[i].track.album.artists[0].name
            playlistSongs[i] = body.tracks.items[i].track.name
            playlistImages[i] = body.tracks.items[i].track.album.images[2].url
          }
          res.send({ 'artists': playlistArtists, 'names': playlistSongs, 'images': playlistImages })
        }
        else if (!error) {
          res.send({ 'artists': [], 'names': [], 'images': [] })
        }
        else
          res.sendStatus(404)
      } catch (err) {

      }
    })
  }
})

function playlistIDPromise(options) {
  return new Promise(function (resolve, reject) {
    request.post(options, function (error, response, body) {
      if (error) {
        reject(error);
      }
      let bodyObject = JSON.parse(body)
      resolve({ 'id': bodyObject.id });
    })
  });
}

app.post('/add-song', function (req, res) {
  let index = partyCodeExists(req.body.pc)
  let at = token_arr[index]
  let userID = user_ids[index]
  let playlistID = playlist_ids[index]
  console.log(playlistID)
  var options = {
    url: 'https://api.spotify.com/v1/users/' + userID + '/playlists/' + playlistID + '/tracks',
    dataType: 'json',
    headers: {
      'Authorization': 'Bearer ' + at,
      'Content-Type': 'application/json'
    },
    qs: {
      uris: req.body.songURI
    },
    json: true
  }
  request.post(options, function (error, response, body) {

  })
  res.sendStatus(200)
})

app.post('/search', function (req, res) {
  console.log(req.body.pc)
  let index = partyCodeExists(req.body.pc)
  let at = token_arr[index]
  console.log("Search request for: " + req.body.track)
  var authOptions = {
    url: 'https://api.spotify.com/v1/search/', //+ req.body.track.split(' ').join('%20') + '&type=track&limit=10',
    //qs: req.body.track.split(' ').join('%20') + '&type=track&limit=10',
    qs: {
      q: req.body.track,
      type: 'track',
      limit: 15
    },
    dataType: 'json',
    headers: {
      'Authorization': 'Bearer ' + at,
      'Content-Type': 'application/json'
    },
    json: true
  }
  searchPromise(authOptions).then(function (data) {
    //res.cookie('tracks', data.tracks)
    if (data.tracks.items.length === 0)
      res.send({ 'artists': [], 'names': [], 'uris': [], 'images': [] })
    else {
      let searchArtists = [15]
      let searchNames = [15]
      let searchURIs = [15]
      let searchImages = [15]
      for (let i = 0; i < data.tracks.items.length; i++) {
        searchArtists[i] = data.tracks.items[i].artists[0].name
        searchNames[i] = data.tracks.items[i].name
        searchURIs[i] = data.tracks.items[i].uri
        searchImages[i] = data.tracks.items[i].album.images[2].url
      }
      let searchResults = { 'artists': searchArtists, 'names': searchNames, 'uris': searchURIs, 'images': searchImages }
      //console.log(JSON.stringify(searchResults))
      //res.cookie(searchResults)
      res.send(searchResults)
    }
    //res.sendStatus(200);
  }).catch(function (err) {
    console.log("ERROR: ", err);
    res.sendStatus(404);
  });
})

function searchPromise(options) {
  return new Promise(function (resolve, reject) {
    request.get(options, function (error, response, body) {
      if (error) {
        reject(error);
      }
      resolve(body);
    })
  });
}

function emailAlreadyRegistered(theEmail) {
  for (var i = 0; i < email_list.length; i++) {
    if (email_list[i] === theEmail) {
      return true;
    }
  }
  return false;
}

function findIndexByEmail(theEmail) {
  for (var i = 0; i < email_list.length; i++) {
    if (email_list[i] == theEmail) {
      console.log(i + " : " + theEmail + " : " + email_list[i]);
      return i;
    }
  }
  return -1;
}

//console.log('Listening on ' + URL_ADDRESS);
app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'))
})
//app.listen(8888);

/*
callFirstPromise().then(function(data) {
  // do stuff with data
  return callSecondPromise();
}).then(function(data) {
  // do stuff with new data
  return callThirdPromise();
}).then(data => {
  return callFourthPromise();
  //finish
}).catch(function(err) {
  // any errors from promises are caught here
  console.log(err);
});*/