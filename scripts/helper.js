var natural = require('natural');
var Analyzer = natural.SentimentAnalyzer;
var stemmer = natural.PorterStemmer;
var tokenizer = new natural.WordTokenizer();
var analyzer = new Analyzer("English", stemmer, "afinn");

async function sentimentAnalysis(id, tag, text) {

    let output = []
    return new Promise((resolve, reject)=>{
        if (text!==undefined){
            // Tokenize string to extract words
            let string = tokenizer.tokenize(text);
            // Get Sentiment expect an array of swords
            const result = analyzer.getSentiment(text);
            output = {
                "id": 'Tweets-ID' +id,
                "tags": tag,
                "content": text,
                "score": result,
            };
            resolve(output);
        }
        else{
            const err = "Undefined data input from Twitter";
            reject(err);
        }
       
    });
  

};



module.exports.sentimentAnalysis = sentimentAnalysis;