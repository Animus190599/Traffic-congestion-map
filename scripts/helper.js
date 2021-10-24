var Analyzer = require('natural').SentimentAnalyzer;
var stemmer = require('natural').PorterStemmer;

var analyzer = new Analyzer("English", stemmer, "afinn");
// getSentiment expects an array of strings
console.log(analyzer.getSentiment(["I", "love", "like"]));
// 0.6666666666666666

function sentimentAnalysis(text) {

    return new Promise

}