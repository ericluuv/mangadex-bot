const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fetch = require('node-fetch');
const { getSessionToken, checkLimit } = require('../postgres/psExport.js');
const { formatOptions } = require('../options.js');


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
  const options = formatOptions('POST', `Bearer ${token}`, bod);

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


async function getListData(listId) {
  //Gets list data from mangadex endpoint.
  await checkLimit();
  const url = `${process.env.MANGADEX_URL}/list/${listId}`;
  const options = formatOptions('GET');

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


async function updateMangaList(mangaId, listId, method) {
  //Adds or deletes manga from the mangaList via it's ID.
  await checkLimit();
  const url = process.env.MANGADEX_URL + `/manga/${mangaId}/list/${listId}`;
  const token = await getSessionToken();
  const options = formatOptions(method, `Bearer ${token}`);
  if (options?.msg) { return; }

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { console.log('add/deleteManga() successful'); }
  else { console.log('add/deleteManga() unsuccessful', json) };
  return json.result;
}

async function getMangaIdsFromList(listId) {
  //Gets all mangaIds from a listId.
  const res = await getListData(listId);
  const toReturn = [];
  for (const rel of res?.relationships) {
    if (rel?.type === 'manga') { toReturn.push(rel?.id); }
  }
  return toReturn;
}


async function getListUpdates(listId) {
  //Returns an array of all mangas in a list that have been updated in the last 20 minutes.
  await checkLimit();
  const timeElasped = new Date(Date.now() - 1.2e+6).toISOString().split('.')[0];
  let url = process.env.MANGADEX_URL + `/list/${listId}/feed`
    + '?translatedLanguage[]=en' + `&createdAtSince=${timeElasped}`
    ;
  const options = formatOptions('GET');
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();

  if (json?.result === 'ok') { return json.data; }
  else {
    console.log('getMangaUpdates() failed.', json);
    return [];
  }
}


module.exports = {
  createList, getListData, updateMangaList, getMangaIdsFromList, getListUpdates
};
