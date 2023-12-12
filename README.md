For users wanting to send and recieve lightning payments on PayMeBTC platforms:

Open client.html, read the instructions, and use the UI within.

For Platforms Implementing:

Create .env file or environemtnal variables in the same directory or accessible fromt he terminal running node with the following values:

port=INTEGER //Used to define the client facing port service will use
ipcPort=INTEGER //Used to define port used by integrating software
cert=FILEPATH //Filepath to certificate file for TLS
key=FILEPATH //Filepath to key file for TLS
debug=BOOLEAN //True or False to enable or disable debug logging
authBytes=INTEGER //Number of bytes used in authentication challenge string and HMAC authentication
ipcWhitelist=ARRAY[IPAddress, IPAddress] //Array of IPC addresses to allow connections from
validAuthDuration=INTEGER // miliseconds of difference allowed in timestamps to limit possible DDoS reuse of valid connection signatures, default 24 hours/1000*60*60*24

Run node server.js
