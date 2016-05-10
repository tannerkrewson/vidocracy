var config = {};

//Port: port in which the server will run off.
config.port = process.env.PORT || 5000;

//Google Browser API Key
config.googleAPIKey = process.env.GOOGLEAPIKEY || 'YOUR API KEY HERE';


module.exports = config;