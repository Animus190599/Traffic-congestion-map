var natural = require('natural');
var Analyzer = require('natural').SentimentAnalyzer;
var stemmer = require('natural').PorterStemmer;
var tokenizer = new natural.WordTokenizer();
var analyzer = new Analyzer("English", stemmer, "afinn");
// getSentiment expects an array of strings
console.log(analyzer.getSentiment(["I", "love", "like"]));
// 0.6666666666666666

async function sentimentAnalysis(id, tag, text) {

    if (text!=undefined){

        result = await(analyzer.getSentiment(text));
        output = {
            "id": 'Tweets-ID' +id,
            "tags": tag,
            "content": text,
            "score": result,

        }
    }

}

async function parseTweet(data) {

}

function parseWord(string){
    return tokenizer.tokenize(string);
}


module.exports.sentimentAnalysis = sentimentAnalysis;