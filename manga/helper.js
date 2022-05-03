const { checkLimit } = require('../postgres/psExport.js');
const { formatOptions } = require('../options.js');
const fetch = require('node-fetch');

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
  const options = formatOptions('GET');

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.name; }
  else { console.log(`URL: ${url} failed`, json); }

}


async function getAuthorName(mangaData) {
  //Gets author name from the mangaData.
  await checkLimit();
  const id = getRelId(mangaData?.relationships, 'author');
  if (id === '') {
    console.log('No suitable id found in getAuthorName', mangaData);
    return;
  }

  const url = `${process.env.MANGADEX_URL}/author/${id}`;
  const options = formatOptions('GET');

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
  const options = formatOptions('GET');

  const res = await fetch(url, options);
  const json = await res.json();
  if (json.result === 'ok') { return json.data?.attributes?.fileName; }
  else { console.log(`URL: ${url} failed`, json); }
}


async function getMangaData(update, id = '') {
  //Gets mangaData from update or through an id.
  await checkLimit();
  if (id === '') {
    id = getRelId(update?.relationships, 'manga');
    if (id === '') {
      console.log('No suitable id found in getMangaData', update);
      return;
    }
  }
  const url = `${process.env.MANGADEX_URL}/manga/${id}`;
  const options = formatOptions('GET');

  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data; }
  else { console.log(`URL: ${url} failed`, json); }
}



module.exports = {
  getScanGroup, getAuthorName, getCoverFileName, getMangaData
}