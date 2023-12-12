# PayMeBTC Server
This is the server portion of the PayMeBTC toolset meant to be run by serive providers

# How to Run 
run `npm install`
Create .env file or environmental variables in the same directory or accessible from the terminal running node with the following values:

```
port=INTEGER //Used to define the client facing port service will use
ipcPort=INTEGER //Used to define port used by integrating software
cert=FILEPATH //Filepath to certificate file for TLS
key=FILEPATH //Filepath to key file for TLS
debug=BOOLEAN //True or False to enable or disable debug logging
authBytes=INTEGER //Number of bytes used in authentication challenge string and HMAC authentication
ipcWhitelist=ARRAY[IPAddress, IPAddress] //Array of IPC addresses to allow connections from
validAuthDuration=INTEGER // miliseconds of difference allowed in timestamps to limit possible DDoS reuse of valid connection signatures, default 24 hours/1000*60*60*24
extrenalAddress=IP/URL // access point for end users to connect to the server
```
Run npm start or node server.js

# How to Implement
At the moment there are only a handful of websockets messages to collect from the server.

New Invoices:
```{"id":"user_identifier","action":"new_invoice","data":"lnbcinvoicedata","requestId":"recipient_id","amount":"amount in sats","timestamp":1702409609698}```

User Offline:
```{"action":"user_offline","id":"user_identifier","requestId":"recipient_id","amount":"#sats","memo":"This is the memo field","msg":"The user user_identifier is not currently online, but your invoice request will be saved and sent to them when they come back online."}```

User Unregistered:
```{"action":"user_unregistered","id":"791741508436492299","requestId":"281970998784557057","amount":"10","memo":"Bitcoin discord user mrrgnome","msg":"The user 791741508436492299 is not registered with PayMeBTC. Please ask them to register."}```

There are also only a handful of messages to send.

Request an invoice:
```'{"action":"request_invoice", "id":"user_identifier", "requestId":"recipient_id", "amount":"amount in sats", "memo":"This is the memo"}```

Register your PayMeBTC instance with a social media server:
```{"action":"register", "id":"user_identifier"}```


