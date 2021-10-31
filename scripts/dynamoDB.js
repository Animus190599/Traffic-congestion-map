var AWS = require('aws-sdk');
// Import NLTK
var helper = require('./helper');
const { extractKeyword } = require('./helper');
// require('dotenv').config({ });
AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION
});

const dynamoClient = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = "n10035575-Twitter";


const getCharacters = async () => {
    const params = {
        TableName: TABLE_NAME,
    };
    const characters = await dynamoClient.scan(params).promise();
    return characters;
};

const getCharacterById = async (id) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            id,
        },
    };
    return await dynamoClient.get(params).promise();
};

const addOrUpdateCharacter = async (character) => {
    console.log("Adding data to database");
    const params = {
        TableName: TABLE_NAME,
        Item: character,
    };
    return await dynamoClient.put(params).promise();
};

const deleteCharacter = async (id) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            id,
        },
    };
    return await dynamoClient.delete(params).promise();
};

async function scanWords() {
    try{
        let dataDB = await getCharacters();
        var word_scores = new Array();
        for (var i=0;i<dataDB.Items.length;i++){
            await helper.extractKeyword(dataDB.Items[i].content).then(result=>{
                if (result.length > 0){
                    word_scores.push(...result);
                }
            }).catch(err=>{
                console.error(err);
            })
            
        }
        return word_scores;
        
    }catch(err){
        console.error(err)
    }
  
};
module.exports = {
    dynamoClient,
    getCharacters,
    getCharacterById,
    addOrUpdateCharacter,
    deleteCharacter,
    scanWords,
};
