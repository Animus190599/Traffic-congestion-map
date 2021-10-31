var natural = require('natural');
var Analyzer = natural.SentimentAnalyzer;
var stemmer = natural.PorterStemmer;
var tokenizer = new natural.WordTokenizer();
var analyzer = new Analyzer("English", stemmer, "afinn");

//Extracting keywords
const keyword_extractor = require("keyword-extractor");
const nlp = require("compromise");

async function sentimentAnalysis(id, tag, text) {
    let output = {};
    return new Promise((resolve, reject)=>{
        if (text!==undefined){
            // Tokenize string to extract words
            let string = tokenizer.tokenize(text);
            // Get Sentiment expect an array of swords
            let sentimentType = [];
            const result = analyzer.getSentiment(string);
            if (result>0){
                sentimentType = "Positive";
            }
            else if (result<0){
                sentimentType = "Negative";
            }
            else{
                sentimentType = "Neutral";
            }
            output = {
                "id": id,
                "tag": tag,
                "content": text,
                "score": result,
                "type": sentimentType,
            };
            resolve(output);
        }
        else{
            const err = "Undefined data input from Twitter";
            reject(err);
        }
    });
};

async function extractKeyword(text){
    return new Promise((resolve, reject)=>{
        if(text!==undefined){
            let doc = nlp(text);
            let string = doc.topics().text()
            const extraction_result =
            keyword_extractor.extract(string,{
                language:"english",
                remove_digits: true,
                return_changed_case:true,
                remove_duplicates: true
            
            });
            resolve(extraction_result);
        }
        else{
            const err = "Undefined data input from Twitter";
            reject(err);
        }
    });
};

function isEmptyObject(obj) {
    return !Object.keys(obj).length;
  }
module.exports.sentimentAnalysis = sentimentAnalysis;
module.exports.extractKeyword = extractKeyword;
module.exports.isEmptyObject = isEmptyObject;