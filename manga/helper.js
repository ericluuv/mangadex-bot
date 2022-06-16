const { checkLimit, getMangaDataRow, updateAuthorName } = require('../postgres/psExport.js');
const { formatOptions } = require('../options.js');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


function getRelId(relationships, type) {
  let id = '';
  for (const types of (relationships || [])) {
    id = types.type === type ? types.id : id;
  }
  return id;
}

function getRelAttr(relationships, type) {
  //Grabs the attributes from the relationships returned in certain mangadex API calls.
  for (const rels of (relationships || [])) {
    if (rels?.type === type) { return rels?.attributes; }
  }
}


async function getMangaData(update, id = '') {
  //Gets mangaData from update or through an id.
  if (id === '') {
    id = getRelId(update?.relationships, 'manga');
    if (id === '') {
      console.log('No suitable id found in getMangaData', update);
      return;
    }
  }
  const url = `${process.env.MANGADEX_URL}/manga/${id}?&includes[]=author&includes[]=cover_art`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data; }
  else { console.log(`URL: ${url} failed`, json); }
}


async function getScanGroup(update) {
  //Grabs scanlation group name from relationships attribute, null if no value.
  const attr = getRelAttr(update?.relationships, 'scanlation_group');
  if (attr) {
    console.log("avoided scanGroup");
    return attr?.name;
  }

  const id = getRelId(update?.relationships, 'scanlation_group');
  if (id === '') {
    console.log('No suitable id found in getScanGroup', update);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/group/${id}`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.name; }
  else { console.log(`URL: ${url} failed`, json); }

}


async function getCoverFileName(mangaData) {
  //Gets coverFileName from mangaData.
  /*
  const id = getRelId(mangaData?.relationships, 'cover_art');
  if (id === '') {
    console.log('No suitable id found in getCoverFileName', mangaData);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/cover/${id}`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options);
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.fileName; }
  else { console.log(`URL: ${url} failed`, json); }*/
  const attr = getRelAttr(mangaData?.relationships, 'cover_art');
  if (attr) {
    console.log("avoided cover_art");
    return attr?.fileName;
  }
}


async function getAuthorName(mangaData, mangaId = '') {
  //Gets author name from the mangaData.
  /*
  if (mangaData && !mangaId) { mangaId = mangaData?.id; }
  const queryRes = await getMangaDataRow(mangaId);
  if (queryRes?.author_name) { return queryRes?.author_name; }
  mangaData = await getMangaData('', mangaId);

  const id = getRelId(mangaData?.relationships, 'author');
  if (id === '') {
    console.log('No suitable id found in getAuthorName', mangaData);
    return;
  }*/
  //Either we have mangaData and no mangaId, or mangaId and no mangaData
  //
  if (mangaId) {
    const queryRes = await getMangaDataRow(mangaId);
    if (queryRes?.author_name) { return queryRes?.author_name; }
  }
  if (!mangaData) { mangaData = await getMangaData('', mangaId); }
  mangaId = mangaData?.id;

  const attr = getRelAttr(mangaData?.relationships, 'author');
  if (attr) {
    console.log("avoided author");
    await updateAuthorName(mangaId, attr?.name || 'Unknown Author');
    return attr?.name;
  }

  /*
  const url = `${process.env.MANGADEX_URL}/author/${id}`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options).catch(err => console(err));
  const json = await res.json();
  if (json.result === 'ok') {
    const authorName = json.data?.attributes?.name || 'Unknown Author';
    await updateAuthorName(mangaId, authorName);
    return authorName;
  }
  else { console.log(`URL: ${url} failed`, json); }*/
}


module.exports = {
  getScanGroup, getAuthorName, getCoverFileName, getRelId, getMangaData, getRelAttr
};
