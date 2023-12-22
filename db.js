import pkg from 'sqlite3';
import { subtle } from 'node:crypto';
import { open } from 'sqlite';
let sqlite3 = pkg;


let db = await open({filename: "./paymeBTC.db", mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, driver: sqlite3.Database});
    
//check if tables exist
let setupQry = `
    CREATE TABLE IF NOT EXISTS PayMeUsers (
        id text NOT NULL PRIMARY KEY UNIQUE,
        challengeString text NOT NULL,
        pendingRequests text,
        staticBTC text
    )
`;
await db.run(setupQry);

//0.0.2 update
let staticBTCUpgradeQry = `
    ALTER TABLE PayMeUsers ADD COLUMN staticBTC text
`;
try {
    await db.run(staticBTCUpgradeQry);
}
catch(ex) {
    console.log("v0.0.2 state check pass");
}

        

async function createUser (id, challengeString, staticBTC) {
    let qry = `INSERT INTO PayMeUsers (id, challengeString, pendingRequests, staticBTC) VALUES (?, ?, '{"pending":[]}', ?)`;
    db.run(qry,[id, challengeString, staticBTC]);
}

async function updateUser (id, challengeString, staticBTC) {
    let qry = `UPDATE PayMeUsers SET challengeString = ?, staticBTC = ? WHERE id = ?`;
    db.run(qry,[challengeString, staticBTC, id]);
}

async function readUser (id){
    let qry = `SELECT * FROM PayMeUsers WHERE id = ?`;
    return db.get(qry,[id]);
}

async function clearPending (id) {
    let qry = `UPDATE PayMeUsers SET pendingRequests = '{"pending":[]}' WHERE id = ?`;
    db.run(qry,[id]);
}

async function updatePending (id, pending) {
    let qry = `UPDATE PayMeUsers SET pendingRequests = ? WHERE id = ?`;
    db.run(qry,[pending, id]);
}

//msg must contain id, signature, and message values.
async function isAuthed (msg)  {
    let res = await readUser(JSON.parse(decodeURIComponent(msg.message)).id);
    if (res != undefined && Object.keys(res).length > 0) {
        return hmacMsg(res.challengeString, msg);
    }
    else
        return false;

}

/*async function hmacMsg(challengeString, msg) {
    const enc = new TextEncoder();
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
        enc.encode(decodeURIComponent(msg.signature)),
        enc.encode(decodeURIComponent(msg.message)),
    );
    console.log(verified);
    console.log(decodeURIComponent(msg.signature));
    console.log(decodeURIComponent(msg.message));

    return verified;
}*/

async function hmacMsg(challengeString, msg) {
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

export { db, createUser, readUser, isAuthed, updateUser, clearPending, updatePending};