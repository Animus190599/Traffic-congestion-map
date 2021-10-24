var express = require('express');
var app = express();

const indexRouter = require('./routes/index');
//const bodyParser = require('body-parser');
var http = require('http');
var debug = require('debug');
const redis = require('redis');
// Import NLTK & Database
var helper = require('./scripts/helper');

// set the view engine to ejs
app.set('view engine', 'ejs');

// use res.render to load up an ejs view file

// index page
app.get('/', function(req, res) {
  res.render('pages/index');
});

// about page
app.get('/about', function(req, res) {
  res.render('pages/about');
});

//app.use(bodyParser.urlencoded({ extended: true }));


//-------------------------Socket Io & Express starter tempalte
/**
* Get port from environment and store in Express.
*/

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

//Socket IO
const socket = require("socket.io");
const { Console } = require('console');
const { RSA_PKCS1_PADDING } = require('constants');
const io = socket(server);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port, () => console.log('Running on port ' + port));
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

//-----------------------------------------------------------------------------App specific

//listen for a new socket connection
io.on('connection', socket  => {
  

  console.log("Client connected: " + socket.id);

  socket.on("New Tags", (tags) => {  
    //Turn twitter stream on if its the first one
  if(!streamConnected){
    StartStream();
    console.log("Opening Stream");
    setTimeout(function(){ CloseStream(); }, 10000); //Close stream after 10 seconds, replace with a check on how many tweets are cached
  }
    //Leave all rooms for deleted tags
    var currentRooms = socket.rooms;
    currentRooms.forEach((item) => {
      if(!tags.includes(item)){
        socket.leave(item);
        console.log("Leaving Room: " + item);
      }
    });

    console.log(currentRooms);
    //Join rooms for new tags
    currentRooms = socket.rooms;
    for (let i = 0; i < tags.length; i++) {
      if(!currentRooms || !currentRooms.has(tags[i])){
        socket.join(tags[i]);
        console.log("Joined room: " + tags[i]);
      }
    }
    AddRules(tags);
  });

  
});


// Redis & Database Initialization
// This section will change for Cloud Services - Redis Client (default port, host)
const redisClient = redis.createClient();
    redisClient.on('error', (err) => {
        console.log("Error " + err);
});



//Twitter API ------------------------------------------------------------------------------------------
const { TwitterApi, ETwitterStreamEvent, TweetStream, ETwitterApiError } = require('twitter-api-v2');

const token =  'AAAAAAAAAAAAAAAAAAAAABt7UwEAAAAATMxFMK7zaygd0r7qSBrMql0x%2FmA%3DfM96kYlUHnozXr2bUQz0ynvydxIZRPHUGocDWCZAUDvk9XAw4Y'; //Bearer Token
const appOnlyClient = new TwitterApi(token); //App-only
v2Client = appOnlyClient.v2; //Use v2 endpoint
let stream; //Global stream
let streamConnected = false;
GetStream();
stream.close();
(async () => {
  await DebugRemoveAllRules();
})();




async function DebugShowAllActiveRules(){
  let currentActiveRules = await GetRules();
  if(currentActiveRules){
    console.log("Active Rules: ")
    console.log(currentActiveRules);
  }
}

async function DebugRemoveAllRules(){
  const rules = await v2Client.streamRules();
  // Log every rule ID
  //console.log(rules.data.map(rule => rule.id));
  console.log(rules);
  if(rules.data){
    let ids = rules.data.map(rule => rule.id);
    RemoveRules(ids);

  }
}


async function GetRules(){
  const rules = await v2Client.streamRules();
  // Log every rule ID
  //console.log(rules.data.map(rule => rule.id));
  if(rules.data){
    return rules.data.map(rule => rule.tag);
  }
}

async function AddRules(tags){
  await GetRules().then(async (response) => {

    //Check if rule already exists
    for (let i = 0; i < tags.length; i++) {
      if(!response || !response.includes(tags[i])){
        //Add new rule
        const addedRules = await v2Client.updateStreamRules({
          add: [{value: tags[i] + " lang: en", tag: tags[i] }]
        });
        console.log("Added new rule: " + tags[i]);
      }
    }

  
  });
}

async function RemoveRules(id){
  const deleteRules = await v2Client.updateStreamRules({
    delete: {
      ids: id,
    },
  });
  console.log("removed rules: " + id);
}

function GetStream(){
  stream = v2Client.searchStream({ autoConnect: false });

  
  // Awaits for a tweet
  stream.on(
    // Emitted when Node.js {response} emits a 'error' event (contains its payload).
    ETwitterStreamEvent.ConnectionError,
    err => console.log('Connection error!', err),
  );
  
  stream.on(
    // Emitted when Node.js {response} is closed by remote or using .close().
    ETwitterStreamEvent.ConnectionClosed,
    () => console.log('Connection has been closed.'),
  );
  
  stream.on(
    // Emitted when a Twitter sent a signal to maintain connection active
    ETwitterStreamEvent.DataKeepAlive,
    () => console.log('Twitter has a keep-alive packet.'),
  );

  //-------------------------------------------------------------------------------------------MAIN STREAM FUNCTION
  stream.on(
    // Emitted when a Twitter payload (a tweet or not, given the endpoint).
    ETwitterStreamEvent.Data,
    eventData => OnStreamInput(eventData)
  );
  
}
async function StartStream(){
  await stream.connect({ autoReconnect: false, autoReconnectRetries: Infinity }).then(()=>{
    streamConnected = true;
  });
}

function OnStreamInput(eventData){
  //console.log('Twitter has sent something:', eventData);

  //What happens when data comes in:
  //Currently sends tweet to client
  //Instead, add tweet to cache, check if cache has over a certain amount of tweets.
  //Analyse all cached tweets
  //Save analysis in cache
  //Send the client the tweet and analysis.
  //Send client data breakdown
  ///Code to make a pie chart:
  // chart = PieChart(population, {
  //   name: d => d.name,
  //   value: d => d.value,
  //   width,
  //   height: 500
  // })
  //Therefore need the title and value of each slice of a pie. E.g. {Good Tweet, 10}, {Bad Tweet, 15}


  //Eventdata is in the form:
  // {
  //   data: {
  //     id: '1452013492433653767',
  //     text: '@Dndnerd4 Haha, I thought the kid or whoever it was had turned a VCR into an oven/grill like those attached to RVs and motorhomes'
  //   },
  //   matching_rules: [ { id: '1452013513078022144', tag: 'Cheese' } ]
  // }
  let id = eventData.data.id;
  let text = eventData.data.text;
  let tag = eventData.matching_rules[0].tag
  const redisKey = `twitter:${tag}`;

  // Run sentiment analysis
  helper.sentimentAnalysis(id, tag, text).then(result =>{
    
  })

  return redisClient.get(rediskey, (err,result)=>{
    if(result) {
      // Serve from cache
      console.log("Data in Redis");
      // const resultJSON = JSON.parse(result);
      // return res.status(200).json(resultJSON);
    }
    else{

    }
  });

  if(eventData.data){
    io.to(eventData.matching_rules[0].tag).emit("New Tweet", eventData); //Send tweet to client
    console.log("Sent Tweet to room: " + eventData.matching_rules[0].tag);
  }
}

function CloseStream(){
  stream.close();
  streamConnected = false;
  console.log("Closing Stream");
}




// Be sure to close the stream where you don't want to consume data anymore from it
//stream.close();



