const mangadex_url = "https://api.mangadex.org";
const list_id = 'a1c6b4c7-d6cc-4a82-97a7-506825bf81c4';
const fetch = require('node-fetch'); 

function getDexTokens() {
  //Logins in using Mangadex credentials.
  const url = mangadex_url + '/auth/login';
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
  const url = mangadex_url + '/auth/refresh';
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

async function updateTokens(sessionToken, refreshToken, pool) {
  //Updates tokens in the database.
  const now = Date.now();
  let temp = [];
  if (sessionToken !== '') {
    let updateStr = `UPDATE dex_tokens SET session_token = '${sessionToken}', session_date = ${now} WHERE da_key = 0`;
    temp.push(pool.query(updateStr, (err, res) => {
      if (err) { console.log(err); }
      console.log('Updated sessionToken in database.');
    }));
  }

  if (refreshToken !== '') {
    let updateStr = `UPDATE dex_tokens SET refresh_token = '${refreshToken}', refresh_date = ${now} WHERE da_key = 0`;
    temp.push(pool.query(updateStr, (err, res) => {
      if (err) { console.log(err); }
      console.log('Updated refreshToken in database');
    }));
  return Promise.all(temp);
  }
}


async function insertTokens(sessionToken, refreshToken, pool) {
  //Inserts tokens into the database, used when table is empty.
  const now = Date.now();
  let insertStr = `INSERT INTO dex_tokens VALUES (0, '${sessionToken}', '${refreshToken}', `;
  insertStr += `${now}, ${now});`;
  
  return pool.query(insertStr, (err1, res1) => {
    if (err1) { console.log(err1); }
    console.log("Inserted new tokens into dex_tokens");
  });
}


async function getSessionToken(pool) {
  //Grabs session token from database, populates the table if necessary.
  //Also refreshes the session token if its been > 14 minutes since last made
  //Refreshes refresh token if its been more than 1 month since last made
  const result = await pool.query('SELECT * from dex_tokens');
  const rows = result.rows;
  if (rows.length === 0 || Date.now() - rows[0].refreshdate >= 1415600000) {
    // table is empty, or both tokens are unusable 
    let tokens = await getDexTokens();
    if (rows.length === 0) {
      await insertTokens(tokens.session, tokens.refresh, pool);
    }
    else {
      await updateTokens(tokens.session, tokens.refresh, pool);
    }
  }
  else {
    //Just grab it fool, and check sessionDate
    if (Date.now() - rows[0].sessiondate >= 840000) {
      //Refresh
      const refreshed = await refreshSession(rows[0].refresh_token);
      console.log('Refreshed token');
      const temp = await updateTokens(refreshed, '', pool);
    }
  }
  return pool.query('SELECT * from dex_tokens').then((res) => {
    return res.rows[0].session_token;
  })
}


async function updateMangaList(mangaId, method, pool) {
  //Adds or deletes manga from the mangaList via it's ID.
  const url = mangadex_url + `/manga/${mangaId}/list/${list_id}`;
  let data = {
    id: mangaId,
    listId: list_id
  };

  const token = await getSessionToken(pool);
  console.log(`Some of bearer token: ${token.slice(0,10)}`);
  let options = {
    method: `${method}`,
    headers: {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { console.log('add/deleteManga() successful'); }
    else { console.log('add/deleteManga() unsuccessful') };
    return json;
  }).catch((err) => {
    console.log(err);
    return;
  });
}

function getTitleInfo(intOptions) {
  // Get mangaID and title from the URL, returns empty string if invalid URL.
  const input = intOptions.getString('url');
  if (input.slice(0, 27) !== 'https://mangadex.org/title/') {
    console.log('Invalid URL');
    return '';
  }
  return input.slice(27).split('/');
}

module.exports = {
  getTitleInfo,
  updateMangaList
};