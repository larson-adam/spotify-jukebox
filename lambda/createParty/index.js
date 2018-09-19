const AWS = require('aws-sdk');

var ddb = new AWS.DynamoDB();

exports.handler = function(event, context, callback) {
  var params = {
  Item: {
   "partyCode": {
     S: event.partyCode
    },
    "host": {
      S: event.host
    },
    "accessToken": {
      S: event.accessToken
    },
    "email": {
      S: event.email
    },
  }, 
  TableName: "parties",
  ReturnValues: "ALL_OLD"
 };
};