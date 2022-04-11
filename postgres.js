require('dotenv').config();
const fetch = require('node-fetch');
const { Pool, Client } = require('pg');
const pool = new Pool({
  /*
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }*/
  connectionString: process.env.DATABASE_STAGING_URL
});

//Session & Refresh token table
const makeTokensTable = 'CREATE TABLE IF NOT EXISTS dex_tokens ( \
  da_key BIGINT PRIMARY KEY,  \
  session_token TEXT,         \
  refresh_token TEXT,         \
  session_date BIGINT,        \
  refresh_date BIGINT         \
  )';

//Guilds Table
const makeGuildsTable = 'CREATE TABLE IF NOT EXISTS guilds ( \
  guild_id TEXT,          \
  list_id TEXT,           \
  channel_id TEXT,        \
  PRIMARY KEY (guild_id)  \
  )';

//Following Table
const makeFollowsTable = 'CREATE TABLE IF NOT EXISTS follows ( \
  user_id TEXT,                    \
  manga_id TEXT,                   \
  guild_id TEXT,                   \
  PRIMARY KEY (user_id, manga_id, guild_id), \
  FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE \
  )';


async function createTables() {
  //Makes all tables if they don't exist for postgresql.
  await pool.connect().then(console.log('PostgreSQL connected.'));

  pool.query(makeTokensTable, (err, res) => {
    if (err) { console.log(err); }
    else { console.log('dex_tokens table made successfully'); }
  });

  pool.query(makeGuildsTable, (err, res) => {
    if (err) { console.log(err); }
    else { console.log('guilds table made successfully'); }
  });

  pool.query(makeFollowsTable, (err, res) => {
    if (err) { console.log(err); }
    else { console.log('follows table made successfully'); }
  });
}

function getDexTokens() {
  //Logins in using Mangadex credentials.
  const url = process.env.MANGADEX_URL + '/auth/login';
  const username = process.env.MANGA_USERNAME;
  const password = process.env.MANGA_PASSWORD;
  let data = { username: username, password: password };
  let options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { return json.token; }
    console.log('getDexTokens() failed.', json);
  }).catch((err) => {
    console.log(err);
    return;
  });
}


function refreshSession(refreshToken) {
  //Refreshes the session token using the refreshToken.
  const url = process.env.MANGADEX_URL + '/auth/refresh';
  let data = { token: refreshToken };
  let options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { return json.token.session; }
    console.log('refreshSession() failed.', json);
  }).catch((err) => {
    console.log(err);
    return;
  });
}


async function updateTokens(sessionToken, refreshToken) {
  //Updates tokens in the database.
  const now = Date.now();
  let temp = [];
  if (sessionToken !== '') {
    let updateStr = `UPDATE dex_tokens SET session_token = '${sessionToken}', session_date = ${now} WHERE da_key = 0;`;
    temp.push(pool.query(updateStr, (err, res) => {
      if (err) { console.log(err); }
      console.log('Updated sessionToken in database');
    }));
  }

  if (refreshToken !== '') {
    let updateStr = `UPDATE dex_tokens SET refresh_token = '${refreshToken}', refresh_date = ${now} WHERE da_key = 0;`;
    temp.push(pool.query(updateStr, (err, res) => {
      if (err) { console.log(err); }
      console.log('Updated refreshToken in database');
    }));
  }
  return Promise.all(temp);
}


async function insertTokens(sessionToken, refreshToken) {
  //Inserts tokens into the database, used when table is empty.
  const now = Date.now();
  let insertStr = `INSERT INTO dex_tokens VALUES (0, '${sessionToken}', '${refreshToken}', `;
  insertStr += `${now}, ${now});`;

  return pool.query(insertStr, (err1, res1) => {
    if (err1) { console.log(err1); }
    console.log("Inserted new tokens into dex_tokens");
  });
}


async function getSessionToken() {
  /*
    Grabs session token from database, populates the table if necessary.
    Also refreshes the session token if its been > 14 minutes since last made
    Refreshes refresh token if its been more than 1 month since last made
  */
  const result = await pool.query('SELECT * from dex_tokens;');
  const rows = result.rows;
  if (rows.length === 0 || Date.now() - rows[0].refresh_date >= 1415600000) {
    // table is empty, or both tokens are unusable 
    let tokens = await getDexTokens();
    if (rows.length === 0) {
      await insertTokens(tokens.session, tokens.refresh);
    }
    else {
      await updateTokens(tokens.session, tokens.refresh);
    }
  }
  else {
    //Just grab it and check sessionDate 
    if (Date.now() - rows[0].session_date >= 840000) {
      //Refresh
      const refreshed = await refreshSession(rows[0].refresh_token);
      console.log('Refreshed token');
      await updateTokens(refreshed, '');
    }
  }
  const res = await pool.query('SELECT * from dex_tokens;');
  return res.rows[0].session_token;
}

function insertGuildRow(guildId, listId, channelId) {
  const insertString = `INSERT INTO guilds VALUES('${guildId}', '${listId}', '${channelId}');`;
  pool.query(insertString, (err, res) => {
    if (err) { console.log(err); }
    else { console.log(`Insertion of ${guildId}, ${listId}, ${channelId} successful`); }
  });
}

async function updateChannelId(guildId, channelId) {
  const updateString = `UPDATE guilds SET channel_id = '${channelId}' WHERE guild_id = '${guildId}';`;
  pool.query(updateString, (err, res) => {
    if (err) { console.log(err); }
    else { console.log(`Update of ${guildId}, ${channelId} successful`); }
  });
}


async function getGuildTable() {
  const selectString = `SELECT * FROM guilds;`;
  return (await pool.query(selectString))?.rows || [];
}




module.exports = {
  createTables,
  getSessionToken,
  insertGuildRow,
  updateChannelId,
  getGuildTable
};

