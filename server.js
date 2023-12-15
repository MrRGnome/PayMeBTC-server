import { createServer } from 'https';
import { readFileSync, readFile } from 'fs';
import { WebSocketServer } from 'ws';
import { randomUUID, randomBytes } from 'crypto';
import { config } from 'dotenv';
import { db, createUser, readUser, isAuthed, updateUser, clearPending, updatePending } from './db.js';

config();
//set default valid hmac time
process.env.validAuthDuration = process.env.validAuthDuration ? process.env.validAuthDuration : 1000*60*60*24;

//this file caches already authorized users
var auths = {};

// .env variables port, icpport, cert, key, debug
const port = process.env.port ? process.env.port : 8008;
const IPCport = process.env.icpport ? process.env.icpPort : 8888;
let wss;
let IPCwss;
if(process.env.cert && process.env.key) {
    const server = createServer({
        cert: readFileSync(process.env.cert),
        key: readFileSync(process.env.key)
    });

    wss = new WebSocketServer({ server });

    server.listen(port);
    console.log("Public server listening on wss://127.0.0.1:" + port );
} else {
    wss = new WebSocketServer({ port: port });
    console.log("Public server listening on ws://127.0.0.1:" + port );
}

IPCwss = new WebSocketServer({ port: IPCport });
console.log("IPC server listening on ws://127.0.0.1:" + IPCport);

function IPCBroadcast(msg) {
    if (process.env.debug)
        console.log("Broadcasting msg to IPC: " + JSON.stringify(msg));
    IPCwss.clients.forEach(function each(client) {
        if (client.readyState == 1) {
            client.send(JSON.stringify(msg));
        }
    });
}

async function register(msg, ws) {
    //does user exist?
    let res = await readUser(msg.id);
    if (res && Object.keys(res).length > 0) {
        //got user
        msg.auth_code = randomBytes(process.env.authbytes ? process.env.authbytes : 4).toString('hex').toUpperCase();
        updateUser(msg.id, msg.auth_code);
    }
    else {
        msg.auth_code = randomBytes(process.env.authbytes ? process.env.authbytes : 4).toString('hex').toUpperCase();
        createUser(msg.id, msg.auth_code);
    }
    let host = process.env.externalAddress ? process.env.externalAddress : "ws://127.0.0.1:8088";
    ws.send('{"action": "registered", "id": "'+ msg.id +'", "auth_code":"' + msg.auth_code + '", "connection_string":"' + host + '>' + msg.auth_code + '>' + msg.id + '", "msg": "You have been successfully registered. To use PayMeBTC tipping please run the PayMeBTC client found at https://github.com/MrRGnome/PayMeBTC-client. You do not need to install anything, and you can easily audit everything. The PayMeBTC client is a self hosted webpage which connects your lnd node to your social media account indirectly through a websocket and software you control. To begin you can visit the previous link or you can download the attached file. When you view the paymebtc.html webpage please add your node information and follow the instructions. **Your connection string is: ' + host + '>' + msg.auth_code + '>' + msg.id + '**"}');
}

function newInvoice(msg, ws) {
    if(!msg.data)
        ws.send('{"action": "error", "msg":"No invoice data in new invoice response"}');
    else
        IPCBroadcast(msg);
}

async function parseIPC(data) {
    let msg;
    try {
        msg = JSON.parse(data);
    }
    catch(e){
        if (process.env.debug)
            console.log("Received non-json IPC data: " + data + e);
       return this.ws.send('{"action": "error", "msg": "Non-JSON IPC Request: ' + data + '"}');
    }

    if(!msg.action){
        if (process.env.debug)
            console.log("Received IPC request missing action value: " + data);
        return this.ws.send('{"action": "error", "msg": "Received IPC request missing action value: ' + data + '"}');
    }
    
    switch(msg.action) {
        case "request_invoice":
            if(!msg.requestId || !msg.id){
                if (process.env.debug)
                    console.log("Received IPC new invoice request missing requestId and id value: " + data);
                return this.ws.send('{"action": "error", "msg": "Received IPC new invoice request missing requestId and id value: ' + data + '"}');
            }
        
            //check if user is live
            if(Object.keys(auths).includes(msg.id))
                auths[msg.id].send(JSON.stringify({action: "new_invoice", requestId: msg.requestId, amount: msg.amount, memo: msg.memo}));
            else {
                let res = await readUser(msg.id);
                if (res && Object.keys(res).length > 0) {
                    //user is offline. Save this request for later or check for unexpired 0 value invoices or bolt12 invoices
                    console.log(res);
                    let pendingRequests = JSON.parse(res.pendingRequests);
                    if(pendingRequests.length < process.env.maxPendingRequests ? proccess.env.maxPendingRequests : 50)
                        pendingRequests.pending.push(JSON.stringify(msg));
                    await updatePending(res.id, JSON.stringify(pendingRequests));
                    msg.action = "user_offline";
                    msg.msg = "The user " + msg.id + " is not currently online, but your invoice request will be saved and sent to them when they come back online."
                    this.ws.send(JSON.stringify(msg));
                }
                else {
                    //user is not registered. save this request for later
                    msg.action = "user_unregistered";
                    msg.msg = "The user " + msg.id + " is not registered with PayMeBTC. Please ask them to register."
                    this.ws.send(JSON.stringify(msg));
                }
            }
                
            
            break;
        case "register":
                register(msg, this.ws);
            break;
    }
}


//messages must be in the format { signature: JSON.stringify(new Uint8Array(sig)), message: encodeURIComponent(JSON.stringify({action: "action-type", id: "id", timestamp: 1234, data: {}}, signature: "signature")), id: id, timestamp: 1234 } 
async function processMessage(msg, ws){
    let data = JSON.stringify(msg);
    let decodedMsg;
    try {
        decodedMsg = JSON.parse(decodeURIComponent(msg.message));
    }
    catch(ex) {
        if (process.env.debug)
            console.log("Received no JSON message in data: " + data);
        ws.send('{"action": "error", "msg": "Malformed Request: ' + data + '"}');
    }
    if(msg.signature && msg.message && decodedMsg.id && Math.abs(decodedMsg.timestamp - Date.now()) < process.env.validAuthDuration && await isAuthed(msg)) {
        console.log("is authed");
        msg = decodedMsg;
        ws.authed = true;
        auths[msg.id] = ws;
    }
    else {
        if (process.env.debug)
            console.log("Unauthorized client message: " + data);
        ws.send('{"action": "error", "msg": "Malformed Request: ' + data + '"}');
        ws.close();
        return;
    }

    if(!msg.id || !msg.action) {
        if (process.env.debug)
            console.log("Received no action in msg data: " + data);
        ws.send('{"action": "error", "msg": "Malformed Request: ' + data + '"}');
        return;
    }

    switch(msg.action) {
        case "register":
            return register(msg, ws);
            break;
        case "new_invoice":
            return newInvoice(msg, ws);
            break;
    }

    //ws.send('{"action": "error", "msg": "Unknown or unauthorized request: ' + data + '"}');
    
}

wss.on('connection', async function connection(ws, req) {
    if (process.env.debug)
            console.log("New connection from: " + ws._socket.remoteAddress);

    //Check for auth. https://github.com/websockets/ws/blob/master/doc/ws.md#event-connection https://github.com/websockets/ws/issues/884
    let searchParams = new URL(req.url, process.env.externalAddress ? process.env.externalAddress : "ws://127.0.0.1:8088").searchParams;
    let cs = JSON.parse(searchParams.get('cs'));
    if(cs.message != undefined && cs.signature != undefined && cs.id != undefined && await isAuthed(cs)) {
        if (process.env.debug)
            console.log("Authenticated connection " + ws._socket.remoteAddress + " as user " + cs.id);
        ws.authed = true;
        ws.id = randomUUID();
        if (auths[cs.id] != undefined) {
            auths[cs.id].close();
            if (process.env.debug)
                console.log("Closed duplicate socket from: " + ws._socket.remoteAddress + " as user " + cs.id);
        }
        auths[cs.id] = ws;
    }
    else {
        //not authenticated
        if (process.env.debug) {
            console.log("Failed authentication attempt from " + ws._socket.remoteAddress + " as user " + cs.id);
        }
        return ws.close();
    }

    if (process.env.debug)
        console.log("New public connection from " + ws._socket.remoteAddress + " as user " + cs.id + ", new ID: " + ws.id);

    //Consume pending requests
    let user = await readUser(cs.id);
    let pendingRequests = JSON.parse(user.pendingRequests);
     pendingRequests.pending.forEach(pending => {
        console.log(pending);
        parseIPC.bind({ws:{send: IPCBroadcast }})(pending);
    }) 
    clearPending(user.id);

    ws.on('message', function message(data) {
        if (process.env.debug)
            console.log("New public message from  Address/ID: " + ws._socket.remoteAddress + "/" + ws.id + ", Message: " + data);
        let msg;
        try {
            msg = JSON.parse(data);
        }
        catch(e) {
            if (process.env.debug)
                console.log("Received non-json data: " + data);
            ws.send('{"action": "error", "msg": "Non-JSON Request: ' + data + '"}');
            return
        }

        processMessage(msg, ws);
        
    });

    ws.on('close', function message(data) {
        //delete auths[]
        auths[ws.id] = undefined;
        if (process.env.debug)
            console.log("Disconnection by " + ws._socket.remoteAddress + "/" + ws.id + ", Message: " + data);
    });
    
});







IPCwss.on('connection', function connection(ws, req) {
    if(process.env.ipcWhitelist && !new Array(process.env.icpWhitelist).includes(req.socket.remoteAddress))
        ws.close();
    if (process.env.debug)
        console.log("New IPC connection from " + ws._socket.remoteAddress);

    ws.on('message', parseIPC.bind({ws: ws}));



    ws.on('close', function message(data) {
        if (process.env.debug)
            console.log('Closed IPC connection');
    });
    
});