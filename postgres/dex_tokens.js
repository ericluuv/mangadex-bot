const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('./psPool.js');
const fetch = require('node-fetch');
const { checkLimit } = require('./limits.js');
const { formatOptions } = require('../options.js');


async function getDexTokens() {
  //Logins in using Mangadex credentials.
  await checkLimit();
  const url = process.env.MANGADEX_URL + '/auth/login';
  const data = { 
    username: process.env.MANGA_USERNAME, 
    password: process.env.MANGA_PASSWORD
  };
  const options = formatOptions('POST', '', data);

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.token; }
  console.log('getDexTokens() failed.', json);
}


async function refreshSession(refreshToken) {
  //Refreshes the session token using the refreshToken.
  await checkLimit();
  const url = process.env.MANGADEX_URL + '/auth/refresh';
  const data = { token: refreshToken };
  const options = formatOptions('POST', '', data);

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.token.session; }
  console.log('refreshSession() failed.', json);
}


async function updateTokens(sessionToken = '', refreshToken = '') {
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
      if (refreshed) { 
        console.log('Refreshed token');
        await updateTokens(refreshed, '');
      }
    }
  }
  const res = await pool.query('SELECT * from dex_tokens;');
  return res.rows[0].session_token;
}

module.exports = { getSessionToken };
