const { formatOptions } = require('../options.js');
const { getRelId } = require('./helper.js');
const { getMangaDataRow, updateMangaTitle, checkLimit } = require('../postgres/psExport.js');
const fetch = require('node-fetch');


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


async function getMangaTitle(mangaId) {
  //Queries table for mangaTitle. If not there, get's it from mangadex.
  const res = await getMangaDataRow(mangaId);
  if (res?.manga_title) { return res?.manga_title; }
  const mangaData = await getMangaData('', mangaId);

  let mangaTitle = mangaData?.attributes?.title;
  mangaTitle = mangaTitle?.en || mangaTitle?.ja || mangaTitle?.['ja-ro'] || 'Unknown Title';

  await updateMangaTitle(mangaId, mangaTitle);
  return mangaTitle;
}


async function aggregateMangaChapters(mangaId) {
  //Gathers chapter numbers and their count.
  let url = `${process.env.MANGADEX_URL}/manga/${mangaId}/aggregate`;
  url += `?translatedLanguage[]=en`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options).catch(err => console.log(err));
  const json = await res.json();
  const mangaTitle = await getMangaTitle(mangaId);
  if (json.result === 'ok') {
    console.log('Aggregated Manga', mangaTitle);
    const existingChapters = {};
    for (const volume of Object.values(json?.volumes)) {
      for (const chapterInfo of Object.values(volume?.chapters)) {
        const chapterNum = chapterInfo.chapter;
        const count = chapterInfo.count;
        if (chapterNum in existingChapters) {
          existingChapters[chapterNum] += count;
        }
        else { existingChapters[chapterNum] = count; }
      }
    }
    return existingChapters;
  }
  else {
    console.log('Aggregated for', mangaId, mangaTitle, 'failed');
  }
}


module.exports = {
  getMangaData, getMangaTitle, aggregateMangaChapters
};
