require('dotenv').config();
const fetch = require('node-fetch');


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
  if (rows.length === 0 || Date.now() - rows[0].refresh_date >= 1415600000) {
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
    //Just grab it and check sessionDate
    if (Date.now() - rows[0].session_date >= 840000) {
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
  const url = process.env.MANGADEX_URL + `/manga/${mangaId}/list/${process.env.LIST_ID}`;
  let data = {
    id: mangaId,
    listId: process.env.LIST_ID
  };

  const token = await getSessionToken(pool);
  console.log(`Some of bearer token: ${token.slice(0, 10)}`);
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
    else { console.log(`add/deleteManga() unsuccessful`) };
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
  const toReturn = input.slice(27).split('/');
  toReturn[1] = toReturn.length > 1 ? toReturn[1].split('-').join(' ') : 'Unknown';
  return toReturn;
}


function getMangaUpdates() {
  //Returns an array of all mangas that have been updated in the last 10 minutes.
  const timeElasped = new Date(Date.now() - 600000).toISOString().split('.')[0];
  let url = process.env.MANGADEX_URL + `/list/${process.env.LIST_ID}/feed`
    + '?translatedLanguage[]=en' + `&createdAtSince=${timeElasped}`
    ;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };
  
  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') {
      return json.data.filter((value, index, self) => {
        return self.indexOf(value) == index;
      });
    }
    else {
      console.log('getMangaUpdates() failed.', json);
    }
  }).catch((err) => {
    console.log(err);
    return [];
  });
}

function getRelId(relationships, type) {
  let id = '';
  for (const types of (relationships || [])) {
    id = types.type === type ? types.id : id;
  }
  return id;
}

function getScanGroup(update) {
  //Grabs scanlation group name from relationships attribute, null if no value.
  const id = getRelId(update?.data[0]?.relationships, 'scanlation_group');
  if (id === '') {
    console.log('No suitable id found in getScanGroup', update);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/group/${id}`;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { return json.data?.attributes?.name; }
    else { console.log(`URL: ${url} failed`, json); }
  }).catch((err) => {
    console.log(err);
  });
}

async function getMangaData(update) {
  //Gets mangaData from update.
  const id = getRelId(update?.data[0]?.relationships, 'manga');
  if (id === '') {
    console.log('No suitable id found in getMangaData', update);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/manga/${id}`;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { return json.data; }
    else { console.log(`URL: ${url} failed`, json); }
  }).catch((err) => {
    console.log(err);
  });
}


function getAuthorName(mangaData) {
  //Gets mangaData from update.
  const id = getRelId(mangaData?.relationships, 'author');
  if (id === '') {
    console.log('No suitable id found in getAuthorName', mangaData);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/author/${id}`;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { return json.data?.attributes?.name; }
    else { console.log(`URL: ${url} failed`, json); }
  }).catch((err) => {
    console.log(err);
  });
}

function getCoverFileName(mangaData) {
  //Gets mangaData from update.
  const id = getRelId(mangaData?.relationships, 'cover_art');
  if (id === '') {
    console.log('No suitable id found in getCoverFileName', mangaData);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/cover/${id}`;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { return json.data?.attributes?.fileName; }
    else { console.log(`URL: ${url} failed`, json); }
  }).catch((err) => {
    console.log(err);
  });
}

async function processUpdates(updates) {
  const toReturn = [];
  for (const update of updates) {
    const mangaData = await getMangaData(update);
    const scanGroup = (await getScanGroup(update)) || '';
    const authorName = (await getAuthorName(mangaData)) || '';
    const coverFileName = await getCoverFileName(mangaData);
    const thumbnailUrl = `https://uploads.mangadex.org/covers/${mangaData.id}/${coverFileName}`;
    const chapter = update.data[0]?.attributes?.chapter || '?';
    const mangaTitle = mangaData?.attributes?.title?.en || 'Unknown Title';
    const chapterTitle = update.data[0]?.attributes?.title || '';
    const embed = {
      'embeds': [{
          'title': `Ch ${chapter} - ${mangaTitle}`,
          'description': `${chapterTitle}\nAuthor: ${authorName}\nGroup: ${scanGroup}`,
          'color': 16742144,
          'footer': { 'text': 'That New New' },
          'url': `https://mangadex.org/chapter/${update.data[0]?.id}`,
          'timestamp': update.data[0]?.attributes?.createdAt,
          'thumbnail': { 'url': thumbnailUrl }
      }]
    };
    toReturn.push(embed);
  }
  return toReturn;
}


module.exports = {
  getTitleInfo,
  updateMangaList,
  getMangaUpdates,
  processUpdates
};
