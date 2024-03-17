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
  //Grabs scanlation group name from relationships attribute.
  const attr = getRelAttr(update?.relationships, 'scanlation_group');
  if (attr) { return attr?.name; }
  else { console.log('Error in getScanGroup', update); }
}


async function getCoverFileName(mangaData) {
  //Gets coverFileName from mangaData.
  const attr = getRelAttr(mangaData?.relationships, 'cover_art');
  if (attr) { return attr?.fileName; }
  else { console.log('Error in getCoverFileName', mangaData); }
}


async function getAuthorName(mangaData, mangaId = '', update=true) {
  //Gets author name from the mangaData.
  if (mangaId) {
    const queryRes = await getMangaDataRow(mangaId);
    if (queryRes?.author_name) { return queryRes?.author_name; }
  }
  if (!mangaData) { mangaData = await getMangaData('', mangaId); }
  mangaId = mangaData?.id;

  const attr = getRelAttr(mangaData?.relationships, 'author');
  if (attr) {
    if (update) { await updateAuthorName(mangaId, attr?.name || 'Unknown Author'); }
    return attr?.name;
  }
  else { console.log('Error in getAuthorName', mangaData, mangaId); }
}


module.exports = {
  getScanGroup, getAuthorName, getCoverFileName, getRelId, getMangaData, getRelAttr
};
