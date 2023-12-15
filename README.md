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

There are also only a handful of messages to send, though each message must be signed with the auth_code provided by the server and wrapped via the hmacMsg function in both client and server.

inital connection:
```
	msg = {timestamp: Date.now(), id:service.id};
	msg = hmacMsg(service.auth_code, msg);
	ws://websocketaddress/?cs=btoa(msg);
```

Where hmacMsg (and hmacUnMsg) are functions:
```
	const { subtle } =  require('node:crypto');

	async function hmacUnMsg(challengeString, msg) {
		const enc = new TextEncoder();
		let jsonArr = JSON.parse(msg.signature);
		let sigArr = new Uint8Array(64);
		for(let i in jsonArr) {
			sigArr[i] = jsonArr[i];
		}
		let key = await subtle.importKey(
			"raw",
			enc.encode(challengeString),
			{name: "HMAC", hash: "SHA-512"},
			false,
			["sign", "verify"]
		);
		let verified = await subtle.verify(
			"HMAC",
			key,
			sigArr.buffer,
			enc.encode(msg.message),
		);

		return verified;
	}

	async function hmacMsg(challengeString, msg) {
		const enc = new TextEncoder();
		const dec = new TextDecoder();
		let timestamp = Date.now();
		msg.timestamp = timestamp;
		let msgStr = encodeURIComponent(JSON.stringify(msg));
		let key = await subtle.importKey(
			"raw",
			enc.encode(challengeString),
			{name: "HMAC", hash: "SHA-512"},
			false,
			["sign", "verify"]
		);
		let sig = await subtle.sign(
			"HMAC",
			key,
			enc.encode(msgStr)
		);
		return { signature: JSON.stringify(new Uint8Array(sig)), message: msgStr, id: msg.id, timestamp: timestamp};
	}
```

The same hmac principles can be followed for all messages sent over the websocket

Request an invoice:
```
	msg = {"action":"request_invoice", "id":"user_identifier", "requestId":"recipient_id", "amount":"amount in sats", "memo":"This is the memo"};
	msg = hmacMsg(service.auth_code, msg);
	websocket.send(msg);

```


