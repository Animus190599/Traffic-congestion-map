require("dotenv").config();
var express = require('express');
var app = express();
var http = require('http');
var debug = require('debug');
// Import Redis
const redis = require('redis');
// Import DynamoDB
const {
  addOrUpdateCharacter,
  getCharacters,
  deleteCharacter,
  getCharacterById,
  scanWords,
} = require('./scripts/dynamoDB');

// Import NLTK
var helper = require('./scripts/helper');

// set the view engine to ejs
app.set('view engine', 'ejs');

//Home page
app.get('/', function(req, res) {
  res.render('pages/index');
});

//Database Analysis Page
app.get('/DatabaseAnalysis', async function(req, res) {  
let word_scores = [];
  try{
    let result =await scanWords();
    for(let i=0;i<result.length;i++){
      if(word_scores.some(e => e.text === result[i])){
        word_scores.find(e => e.text === result[i]).size++;
      }else{
        word_scores.push({text: result[i], size: 1});
      }
    }
    word_scores.sort(function(a,b){
      return b.size - a.size;
    });
    highest_score = word_scores[0].size;
    res.render('pages/DatabaseAnalysis', {word_scores: word_scores, highest_score: highest_score});
  
  } catch(err){
    console.log("Error getting words from database");
    res.render('pages/DatabaseAnalysis', {word_scores: [], highest_score: 1});
  }

});

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
const redisAdapter = require('socket.io-redis');
const { Console } = require('console');
const { RSA_PKCS1_PADDING } = require('constants');
const io = socket(server);
if(process.env.REDIS_URL){
  io.adapter(redisAdapter({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT }));
}
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
    setTimeout(function(){ CloseStream(); }, 20000); //Close stream after 20 seconds
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
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});
    redisClient.on('error', (err) => {
        console.log("Error " + err);
});



//Twitter API ------------------------------------------------------------------------------------------
const { TwitterApi, ETwitterStreamEvent, TweetStream, ETwitterApiError } = require('twitter-api-v2');
const e = require("cors");
const { isEmptyObject } = require("jquery");

const token =  process.env.Twitter_Bearer_Token; //Bearer Token
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
  //Eventdata is in the form:
  // {
  //   data: {
  //     id: '1452013492433653767',
  //     text: '@Dndnerd4 Haha, I thought the kid or whoever it was had turned a VCR into an oven/grill like those attached to RVs and motorhomes'
  //   },
  //   matching_rules: [ { id: '1452013513078022144', tag: 'Cheese' } ]
  // }
  if (eventData.data){
    let id = eventData.data.id;
    let text = eventData.data.text;
    let tag = eventData.matching_rules[0].tag
    const redisKey = `twitter:${tag}`;
    let dataAnalyze = [];

    redisClient.hget(redisKey, async (err, res)=>{
        if(res && res[id]!==undefined){
            console.log("Data existed in Redis");
            dataAnalyze = redisClient.hget(redisKey, id);
        }
        else {
            try{
                //Try database
                let dataDB =  await getCharacterById(id);
                if(!helper.isEmptyObject(dataDB)){
                    console.log("Saving to Redis Cache");
                    // console.log(JSON.stringify(dataDB));
                    redisClient.hset(redisKey, dataDB.Item.id, JSON.stringify(dataDB.Item));
                    dataAnalyze = dataDB.Item;
                }else{
                  console.log("Calculating Sentiment")
                    await helper.sentimentAnalysis(id, tag, text).then(async result =>{
                        console.log("Saving to Redis Cache");
                        redisClient.hset(redisKey, result.id, JSON.stringify(result));
                        console.log("Saving to Database")
                        try{
                          const newItem = await addOrUpdateCharacter(result);
                        } catch (err){
                          console.error(err);
                        }
                        dataAnalyze = result;
                    }). catch(err=>{
                        console.error(err);
                    })
                    
                }
            } catch(err){
                console.log(err);
            }

          
          }
        if(dataAnalyze){
          io.to(dataAnalyze.tag).emit("New Tweet", dataAnalyze); //Send tweet to client
          console.log("Sent Tweet to room: " + dataAnalyze.tag);
        }
    });
   

  }
  
}

function CloseStream(){
  stream.close();
  streamConnected = false;
  console.log("Closing Stream");
}



