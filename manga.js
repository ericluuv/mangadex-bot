require('dotenv').config();
const fetch = require('node-fetch');
const { getSessionToken, checkLimit } = require('./postgres.js');

async function updateMangaList(mangaId, listId, method) {
  //Adds or deletes manga from the mangaList via it's ID.
  await checkLimit();
  const url = process.env.MANGADEX_URL + `/manga/${mangaId}/list/${listId}`;
  const token = await getSessionToken();
  let options = {
    method: `${method}`,
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { console.log('add/deleteManga() successful'); }
  else { console.log('add/deleteManga() unsuccessful', json) };
  return json.result;
}


function getMangaId(intOptions) {
  // Get mangaID from the URL, returns empty string if invalid URL.
  const input = intOptions.getString('url');
  if (input.slice(0, 27) === 'https://mangadex.org/title/') {
    return input.slice(27).split('/')[0];
  }
  console.log('Invalid URL', input);
  return '';
}


function getListId(intOptions) {
  //Grabs listID and list name from listUrl.
  const input = intOptions.getString('url');
  if (input.slice(0, 26) !== 'https://mangadex.org/list/') {
    console.log('Invalid URL', input);
    return '';
  }
  return input.slice(26).split('/')[0];
}


async function getMangaUpdates(listId) {
  //Returns an array of all mangas that have been updated in the last 20 minutes.
  await checkLimit();
  const timeElasped = new Date(Date.now() - 1.2e+6).toISOString().split('.')[0];
  let url = process.env.MANGADEX_URL + `/list/${listId}/feed`
    + '?translatedLanguage[]=en' + `&createdAtSince=${timeElasped}`
    ;
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();

  if (json?.result === 'ok') {
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
}


async function getListData(listId) {
  //Gets list data from mangadex endpoint.
  await checkLimit();
  const url = `${process.env.MANGADEX_URL}/list/${listId}`;
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') {
    console.log('List data successful');
    return json.data;
  }
  else {
    console.log('List Data not successful');
    return json;
  }
}


function getRelId(relationships, type) {
  let id = '';
  for (const types of (relationships || [])) {
    id = types.type === type ? types.id : id;
  }
  return id;
}


async function getScanGroup(update) {
  //Grabs scanlation group name from relationships attribute, null if no value.
  await checkLimit();
  const id = getRelId(update?.relationships, 'scanlation_group');
  if (id === '') {
    console.log('No suitable id found in getScanGroup', update);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/group/${id}`;
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.name; }
  else { console.log(`URL: ${url} failed`, json); }

}


async function getMangaData(update, id = '') {
  //Gets mangaData from update.
  await checkLimit();
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
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data; }
  else { console.log(`URL: ${url} failed`, json); }
}


async function getAuthorName(mangaData) {
  //Gets mangaData from update.
  await checkLimit();
  const id = getRelId(mangaData?.relationships, 'author');
  if (id === '') {
    console.log('No suitable id found in getAuthorName', mangaData);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/author/${id}`;
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options).catch(err => console(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.name; }
  else { console.log(`URL: ${url} failed`, json); }

}


async function getCoverFileName(mangaData) {
  //Gets mangaData from update.
  await checkLimit();
  const id = getRelId(mangaData?.relationships, 'cover_art');
  if (id === '') {
    console.log('No suitable id found in getCoverFileName', mangaData);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/cover/${id}`;
  const options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options);
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.fileName; }
  else { console.log(`URL: ${url} failed`, json); }
}


async function processUpdates(updates) {
  //Returns the updates in an embed format for discord.
  const toReturn = [];
  for (const update of updates) {
    const mangaData = await getMangaData(update);
    const scanGroup = (await getScanGroup(update)) || 'Unknown Group';
    const authorName = (await getAuthorName(mangaData)) || 'Unknown Author';
    const coverFileName = await getCoverFileName(mangaData);
    const thumbnailUrl = `https://uploads.mangadex.org/covers/${mangaData?.id}/${coverFileName}`;
    const chapter = update?.attributes?.chapter || '?';
    let mangaTitle = mangaData?.attributes?.title; 
    mangaTitle = mangaTitle?.en || mangaTitle?.ja || mangaTitle?.['ja-ro']|| 'Unknown Title';
    const chapterTitle = update?.attributes?.title || '';
    const embed = {
      'toSend': {
        'title': `Ch ${chapter} - ${mangaTitle}`,
        'description': `${chapterTitle}\nAuthor: ${authorName}\nGroup: ${scanGroup}`,
        'color': 16742144,
        'footer': { 'text': 'That New New' },
        'url': `https://mangadex.org/chapter/${update?.id}`,
        'timestamp': update?.attributes?.createdAt,
        'thumbnail': { 'url': thumbnailUrl }
      },
      'manga_id': mangaData.id
    };
    toReturn.push(embed);
  };
  return toReturn;
}


async function createList(listName) {
  //Creates a new list for a server.
  await checkLimit();
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
      'Accept': 'application/json',
      'Content-type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };


  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') {
    console.log(`${listName} successfully created`);
    return json.data.id;
  }
  else {
    console.log(`${listName} could not be created.`, json);
  }

}


async function getFieldsFromMangaIds(mangaIds) {
  //Input of mangaIds, returns fields array for discord messageEmbed with hyperlinks.
  const results = [];
  for (const mangaId of mangaIds) {
    results.push(await getMangaData('', mangaId));
  }
  const fields = [];
  /*
  for (const mangaData of results) {
    const authorName = (await getAuthorName(mangaData)) || 'Unknown Author';
    const mangaTitle = mangaData?.attributes?.title?.en || 'Unknown Title';
    const temp = {
      'name': `${mangaTitle}`,
      'value': `Author: ${authorName}
      [MangaDex Link](https://mangadex.org/title/${mangaData?.id}/)`,
    };
    fields.push(temp);
  }*/
  for (const mangaData of results) {
    let mangaTitle = mangaData?.attributes?.title; 
    mangaTitle = mangaTitle?.en || mangaTitle?.ja || mangaTitle?.['ja-ro']|| 'Unknown Title';
    const temp = {
      'name': `${mangaTitle}`,
      'value': `[MangaDex Link](https://mangadex.org/title/${mangaData?.id}/)`
    };
    fields.push(temp);
  }
  return fields;
}


async function getMangaIdsFromList(listId) {
  //Gets all mangaIds from a listId.
  await checkLimit();
  const url = process.env.MANGADEX_URL + `/list/${listId}`;
  let options = {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  };

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') {
    console.log('getList() successful');
  }
  else { console.log('getList() unsuccessful', json) };
  return json?.data?.relationships.filter(rel => rel.type === 'manga').map(rel => rel.id) || [];
}


module.exports = {
  getMangaId,
  updateMangaList,
  getMangaUpdates,
  processUpdates,
  createList,
  getFieldsFromMangaIds,
  getMangaIdsFromList,
  getListId,
  getMangaData,
  getListData
};
