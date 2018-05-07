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


//const URL_ADDRESS = "192.168.1.3";
const URL_ADDRESS = "localhost";

var client_id = 'a00ebad9444f4848b35b79bb9f225cbd'; // Your client id
var client_secret = 'b216eba609be4c0fb0148c678732fc98'; // Your secret
var redirect_uri = 'http://' + URL_ADDRESS + ':8888/callback'; // Your redirect uri
var token_arr = new Array();
var party_code_arr = new Array();
var email_list = new Array();


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

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


app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

function hostLoginPromise(options) {
  return new Promise(function(resolve, reject) {
    request.get(options, function(error, response, body) {
      if (error) {
        reject(error);
      }
      current_email = body.email;
      console.log(current_email);
      resolve(body.email);
    })
  });
}

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

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

    request.post(authOptions, function(error, response, body) {
      var party_code = generateRandomString(4);
      var current_email = "";
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        hostLoginPromise(options).then(function(data) {
          console.log(data);
          var current_index = email_list.indexOf(data);
          if(current_index === -1) {
            party_code_arr[party_code_arr.length] = party_code;
            token_arr[token_arr.length] = access_token;
            email_list[email_list.length] = data;
          }
          else {
            party_code = party_code_arr[current_index];
            access_token = token_arr[current_index];
          }
          res.cookie("pc", party_code);
          res.redirect('/host.html');
        }).catch(function(err) {
          console.log("ERROR: ", err);
        });

      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
      function setCurrentEmail(theEmail) {
        current_email = theEmail;
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

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

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token,
      });
    }
  });
});

app.get('/getPlaylist', function(request, response) {
  console.log(request.body.pc);
  var aOptions = {
    url: 'https://api.spotify.com/v1/users/{user_id}/playlists/{playlist_id}',
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  }
});

app.post('/addSong', function(request, response) {
  //console.log(request.body);
  if (request.body.partyCode === '1234')
    response.sendStatus(200);
  else
    response.sendStatus(404);
});

function emailAlreadyRegistered(theEmail) {
  for(var i = 0; i < email_list.length; i++) {
    if(email_list[i] === theEmail) {
      return true;
    }
  }
  return false;
}

function findIndexByEmail(theEmail) {
  for(var i = 0; i < email_list.length; i++) {
    if(email_list[i] == theEmail) {
      console.log(i + " : " + theEmail + " : " + email_list[i]);
      return i;
    }
  }
  return -1;
}

console.log('Listening on 8888');
app.listen(8888);

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