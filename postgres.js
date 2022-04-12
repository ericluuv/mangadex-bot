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
  const promises = [
    pool.connect().then(console.log('PostgreSQL connected.')),

    pool.query(makeTokensTable)
      .then(console.log('dex_tokens table made successfully'))
      .catch(err => console.log(err)),

    pool.query(makeGuildsTable)
      .then(console.log('guilds table made successfully'))
      .catch(err => console.log(err)),

    pool.query(makeFollowsTable)
      .then(console.log('follows table made successfully'))
      .catch(err => console.log(err)),
  ];
  await Promise.all(promises);
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
  }).catch(err => console.log(err));
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
  }).catch(err => console.log(err));
}


async function updateTokens(sessionToken, refreshToken) {
  //Updates tokens in the database.
  const now = Date.now();
  let temp = [];
  if (sessionToken !== '') {
    let updateStr = `UPDATE dex_tokens SET session_token = '${sessionToken}', session_date = ${now} WHERE da_key = 0;`;
    const upd1 = pool.query(updateStr).then(res => {
      if (res?.rowCount === 1) {
        console.log('Updated sessionToken in database');
      }
      else { console.log('SessionToken not in db'); }
    }).catch(err => console.log(err));
    temp.push(upd1);
  }

  if (refreshToken !== '') {
    let updateStr = `UPDATE dex_tokens SET refresh_token = '${refreshToken}', refresh_date = ${now} WHERE da_key = 0;`;
    const upd2 = pool.query(updateStr).then(res => {
      if (res?.rowCount === 1) {
        console.log('Updated refreshToken in database');
      }
      else { console.log('RefreshToken not in db'); }
    }).catch(err => console.log(err));
    temp.push(upd2);
  }
  return Promise.all(temp);
}


async function insertTokens(sessionToken, refreshToken) {
  //Inserts tokens into the database, used when table is empty.
  const now = Date.now();
  let insertStr = `INSERT INTO dex_tokens VALUES (0, '${sessionToken}', '${refreshToken}', `;
  insertStr += `${now}, ${now});`;

  return pool.query(insertStr)
    .then(res => {
      if (res?.rowCount === 1) {
        console.log('Inserted new tokens into dex_tokens');
      }
      else { console.log('No insertion'); }
    }).catch(err => console.log(err));
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
      await insertTokens(tokens?.session, tokens?.refresh);
    }
    else {
      await updateTokens(tokens?.session, tokens?.refresh);
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
  //Inserts a new row into guilds table.
  const insertString = `INSERT INTO guilds VALUES('${guildId}', '${listId}', '${channelId}');`;
  return pool.query(insertString).then(res => {
    if (res?.rowCount === 1) {
      console.log(`Insertion of ${guildId}, ${listId}, ${channelId} successful`);
    }
    else { console.log(`No insertion of ${guildId}', '${listId}', '${channelId}`); }
  }).catch(err => console.log(err));
}

async function updateChannelId(guildId, channelId) {
  //Updates channelId based on guildId and channelId.
  const updateString = `UPDATE guilds SET channel_id = '${channelId}' WHERE guild_id = '${guildId}';`;
  return pool.query(updateString).then(res => {
    if (res?.rowCount === 1) {
      console.log(`Update of ${guildId}, ${channelId} successful`);
    }
    else { console.log(`No update of ${guildId}', '${channelId}`); }
  }).catch(err => console.log(err));
}


function getGuildTable() {
  //Returns the guilds table with all its rows.
  const selectString = `SELECT * FROM guilds;`;
  return pool.query(selectString).then(res => res?.rows).catch(err => {
    console.log(err);
    return [];
  });
}

function getGuildRow(guildId) {
  //Returns row with corresponding guildId.
  const selectString = `SELECT * FROM guilds WHERE guild_id = '${guildId}';`;
  return pool.query(selectString).then(res => { return res.rows; })
  .catch(err => {
    console.log(err);
    return [];
  });
}


async function insertFollow(userId, mangaId, guildId) {
  //Returns true if a new follow was added, false if not.
  const checkString = `SELECT * FROM follows WHERE user_id = '${userId}' AND 
  manga_id = '${mangaId}' AND guild_id = '${guildId}';`;
  const insertString = `INSERT INTO follows VALUES ('${userId}', '${mangaId}', '${guildId}');`;

  const len = await pool.query(checkString).then(res => res?.rowCount);
  if (len === 0) {
    const status = await pool.query(insertString).then(res => res?.rowCount);
    if (status == 1) { return true; }
  }
  else {
    return false;
  }
}

function delFollow(userId, mangaId, guildId) {
  //Deletes the specified row from the follows table;
  const deleteString = `DELETE FROM follows WHERE user_id = '${userId}' AND
  manga_id = '${mangaId}' AND guild_id = '${guildId}';`;
  return pool.query(deleteString).then(res => res?.rowCount)
  .catch(err => console.log(err));
}

function getMangaCount(mangaId) {
  const countString = `SELECT COUNT(*) FROM follows WHERE manga_id = '${mangaId}';`;
  return pool.query(countString).then(res => res?.rows?.[0]?.count)
  .catch(err => console.log(err));
}



module.exports = {
  createTables,
  getSessionToken,
  insertGuildRow,
  updateChannelId,
  getGuildTable,
  getGuildRow,
  insertFollow,
  delFollow,
  getMangaCount
};
