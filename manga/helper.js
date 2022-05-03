const { checkLimit, getMangaDataRow, updateMangaTitle, updateAuthorName } = require('../postgres/psExport.js');
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
  //Gets mangaData from update.
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
  else { console.log(`URL: ${url} failed`, json); }
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
  const url = `${process.env.MANGADEX_URL}/manga/${id}`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  if (json.result === 'ok') { return json.data; }
  else { console.log(`URL: ${url} failed`, json); }
}


async function getAuthorName(mangaData, mangaId = '') {
  //Gets author name from the mangaData.
  if (mangaId) {
    const res = await getMangaDataRow(mangaId);
    if (res?.author_name) { return res?.author_name; }
    mangaData = await getMangaData('', mangaId);
  }
  else {
    mangaId = mangaData?.id;
  }

  const id = getRelId(mangaData?.relationships, 'author');
  if (id === '') {
    console.log('No suitable id found in getAuthorName', mangaData);
    return;
  }

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
  else { console.log(`URL: ${url} failed`, json); }
}


async function getMangaTitle(mangaData, mangaId = '') {
  //Queries table for mangaTitle. If not there, get's it from mangadex.
  if (mangaId) {
    const res = await getMangaDataRow(mangaId);
    if (res?.manga_title) { return res?.manga_title; }
    mangaData = await getMangaData('', mangaId);
  }
  else { mangaId = mangaData?.id; }

  let mangaTitle = mangaData?.attributes?.title;
  mangaTitle = mangaTitle?.en || mangaTitle?.ja || mangaTitle?.['ja-ro'] || 'Unknown Title';
  
  await updateMangaTitle(mangaId, mangaTitle);
  return mangaTitle;
}


module.exports = {
  getScanGroup, getAuthorName, getCoverFileName, getMangaData, getMangaTitle
};
