require('dotenv').config();
const fetch = require('node-fetch');
const { getSessionToken } = require('./postgres.js');

function updateMangaList(mangaId, listId, method, token) {
  //Adds or deletes manga from the mangaList via it's ID.
  const url = process.env.MANGADEX_URL + `/manga/${mangaId}/list/${listId}`;
  let options = {
    method: `${method}`,
    headers: {
      'Content-type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  return fetch(url, options).then(res => res.json())
    .then(json => {
      if (json.result === 'ok') { console.log('add/deleteManga() successful'); }
      else { console.log('add/deleteManga() unsuccessful', json) };
      return json.result;
    })
    .catch(err => console.log(err));
}



function getTitleInfo(intOptions) {
  // Get mangaID and title from the URL, returns empty string if invalid URL.
  const input = intOptions.getString('url');
  if (input.slice(0, 27) !== 'https://mangadex.org/title/') {
    console.log('Invalid URL', input);
    return ['', ''];
  }
  const toReturn = input.slice(27).split('/');
  toReturn[1] = toReturn.length > 1 ? toReturn[1].split('-').join(' ') : 'Unknown';
  return toReturn;
}

function getListId(intOptions) {
  //Grabs listID and list name from listUrl.
  const input = intOptions.getString('url');
  const toReturn = [];
  if (input.slice(0, 26) !== 'https://mangadex.org/list/') {
    console.log('Invalid URL', input);
    return ['', ''];
  }
  toReturn[0] = input.slice(26, input.indexOf('/', 26));
  if (input.includes('?')) { toReturn[1] = input.slice(input.indexOf('/', 26) + 1, input.indexOf('?')); }
  else { toReturn[1] = input.slice(input.indexOf('/', 26) + 1); }
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

  return fetch(url, options).then(res => res.json()).then(json => {
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
      return [];
    }
  }).catch(err => {
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

  return fetch(url, options).then(res => res.json()).then(json => {
    if (json.result === 'ok') { return json.data?.attributes?.name; }
    else { console.log(`URL: ${url} failed`, json); }
  }).catch((err) => {
    console.log(err);
  });
}


async function getMangaData(update, id = '') {
  //Gets mangaData from update.
  if (id === '') {
    id = getRelId(update?.relationships, 'manga');
    if (id === '') {
      console.log('No suitable id found in getMangaData', update);
      return;
    }
  }
  const url = `${process.env.MANGADEX_URL}/manga/${id}`;
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  return fetch(url, options).then(res => res.json()).then(json => {
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

  return fetch(url, options).then(res => res.json()).then(json => {
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

  return fetch(url, options).then(res => res.json()).then(json => {
    if (json.result === 'ok') { return json.data?.attributes?.fileName; }
    else { console.log(`URL: ${url} failed`, json); }
  }).catch((err) => {
    console.log(err);
  });
}


async function processUpdates(updates) {
  //Returns the updates in an embed format for discord.
  return updates.map(async update => {
    const mangaData = await getMangaData(update);
    const scanGroup = (await getScanGroup(update)) || 'Unknown Group';
    const authorName = (await getAuthorName(mangaData)) || 'Unknown Author';
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
    return embed;
  });
}


async function createList(listName) {
  //Creates a new list for a server.
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

  return fetch(url, options).then(res => res.json()).then(json => {
    if (json.result === 'ok') {
      console.log(`${listName} successfully created`);
      return json.data.id;
    }
    else {
      console.log(`${listName} could not be created.`, json);
    }
  }).catch(err => console.log(err));
}


async function getMangaEmbeds(mangaIds) {
  //Input of mangaIds, gets manga data and returns embeds for all of them.
  const toPromise = mangaIds.map(mangaId => getMangaData('', mangaId));
  const results = await Promise.all(toPromise);
  return results.map(async mangaData => {
    const authorName = (await getAuthorName(mangaData)) || 'Unknown Author';
    const coverFileName = await getCoverFileName(mangaData);
    const thumbnailUrl = `https://uploads.mangadex.org/covers/${mangaData?.id}/${coverFileName}`;
    const mangaTitle = mangaData?.attributes?.title?.en || 'Unknown Title';
    const embed = {
      'embeds': [{
        'title': `${mangaTitle}`,
        'description': `Author: ${authorName}`,
        'color': 16742144,
        //'footer': { 'text': 'That New New' },
        'url': `https://mangadex.org/title/${mangaData?.id}/`,
        'thumbnail': { 'url': thumbnailUrl }
      }]
    };
    return embed;
  });
}

async function getMangaIdsFromList(listId) {
  //Gets all mangaIds from a listId.
  const url = process.env.MANGADEX_URL + `/list/${listId}`;
  let options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  /*
  return fetch(url, options).then(async (res) => {
    const json = await res.json();
    if (json.result === 'ok') { 
      console.log('getList() successful');
    }
    else { console.log('getList() unsuccessful', json) };
    return json?.data?.relationships.filter(rel => rel.type === 'manga').map(rel => rel.id) || [];
  }).catch((err) => {
    console.log(err);
  });*/
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') {
    console.log('getList() successful');
  }
  else { console.log('getList() unsuccessful', json) };
  return json?.data?.relationships.filter(rel => rel.type === 'manga').map(rel => rel.id) || [];
}


module.exports = {
  getTitleInfo,
  updateMangaList,
  getMangaUpdates,
  processUpdates,
  createList,
  getMangaEmbeds,
  getMangaIdsFromList,
  getListId
};

async function test() {
  const timeElasped = new Date(Date.now() - 1.2e+6).toISOString().split('.')[0];
  let url = process.env.MANGADEX_URL + `/list/faeb7e65-cf01-4c9b-8ab8-ce6c1a2b4579/feed`
    + '?translatedLanguage[]=en' + `&createdAtSince=${timeElasped}`
    ;
  url = 'https://api.mangadex.org/list/faeb7e65-cf01-4c9b-8ab8-ce6c1a2b4579/feed?translatedLanguage[]=en&createdAtSince=2022-04-13T01:03:33';
  const options = {
    method: 'GET',
    headers: { 'Content-type': 'application/json' }
  };

  const res = await (fetch(url, options).then(res => res.json()));
  console.log(res);
}

test();