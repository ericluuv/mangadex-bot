require('dotenv').config();
const fetch = require('node-fetch');
const { getSessionToken } = require('./postgres.js');

async function updateMangaList(mangaId, method) {
  //Adds or deletes manga from the mangaList via it's ID.
  const url = process.env.MANGADEX_URL + `/manga/${mangaId}/list/${process.env.LIST_ID}`;
  let data = {
    id: mangaId,
    listId: process.env.LIST_ID
  };

  const token = await getSessionToken();
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


function getMangaUpdates(listId) {
  //Returns an array of all mangas that have been updated in the last 20 minutes.
  const timeElasped = new Date(Date.now() - 1.2e+6).toISOString().split('.')[0];
  let url = process.env.MANGADEX_URL + `/list/${listId}/feed`
    + '?translatedLanguage[]=en' + `&createdAtSince=${timeElasped}`
    ;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') {
      const toReturn = []
      const uniques = new Set();
      for (const update of json.data) {
        if (!uniques.has(update.id)) {
          uniques.add(update.id);
          toReturn.push(update);
        }
      }
      for (const c of toReturn) {
        console.log('Returned data items', c);
      }
      return toReturn;
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
  const id = getRelId(update?.relationships, 'scanlation_group');
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
  const id = getRelId(update?.relationships, 'manga');
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
    const thumbnailUrl = `https://uploads.mangadex.org/covers/${mangaData?.id}/${coverFileName}`;
    const chapter = update?.attributes?.chapter || '?';
    const mangaTitle = mangaData?.attributes?.title?.en || 'Unknown Title';
    const chapterTitle = update?.attributes?.title || '';
    const embed = {
      'embeds': [{
        'title': `Ch ${chapter} - ${mangaTitle}`,
        'description': `${chapterTitle}\nAuthor: ${authorName}\nGroup: ${scanGroup}`,
        'color': 16742144,
        'footer': { 'text': 'That New New' },
        'url': `https://mangadex.org/chapter/${update?.id}`,
        'timestamp': update?.attributes?.createdAt,
        'thumbnail': { 'url': thumbnailUrl }
      }]
    };
    toReturn.push(embed);
  }
  return toReturn;
}


async function createList(listName) {
  const url = `${process.env.MANGADEX_URL}/list`;
  const bod = {
    name: listName,
    visibility: 'public'
  };
  const token = await getSessionToken();
  console.log(`Some of bearer token: ${token.slice(0, 10)}`);
  const options = {
    method: 'POST',
    body: JSON.stringify(bod),
    headers: {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') {
      console.log(`${listName} successfully created`);
      return json.data.id;
    }
    else {
      console.log(`${listName} could not be created.`, json);
    }
  }).catch((err) => {
    console.log(err);
  });
}


module.exports = {
  getTitleInfo,
  updateMangaList,
  getMangaUpdates,
  processUpdates,
  createList
};