const { formatOptions } = require('../options.js');
const { getMangaData } = require('./helper.js');
const { getMangaDataRow, updateMangaTitle, checkLimit } = require('../postgres/psExport.js');
const fetch = require('node-fetch');
const path = require('path');
const { getMalData } = require('./mal.js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


async function getMangaTitle(mangaId, mangaData = '') {
  //Queries table for mangaTitle. If not there, gets it from mangadex.
  if (mangaId) {
    const res = await getMangaDataRow(mangaId);
    if (res?.manga_title) { return res?.manga_title; }
  }
  if (!mangaData) { mangaData = await getMangaData('', mangaId); }
  mangaId = mangaData?.id;

  let mangaTitle = mangaData?.attributes?.title;
  mangaTitle = mangaTitle?.en || mangaTitle?.ja || mangaTitle?.['ja-ro'] || 'Unknown Title';
  await updateMangaTitle(mangaId, mangaTitle);

  return mangaTitle;
}


async function getMangaIdFromMal(title, malId) {
  //Grabs mangaId on mangadex from malIds
  const url = `${process.env.MANGADEX_URL}/manga?limit=50&title=${title}?&includes[]=author`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options);
  const json = await res.json();
  if (json?.result === 'ok') {
    for (const mangaData of json?.data) {
      const malMatch = mangaData?.attributes?.links?.mal === malId;
      const mangaDexTitle = await getMangaTitle('', mangaData);
      const titleMatch = mangaDexTitle === title;
      if (malMatch || titleMatch) { return [mangaData?.id, mangaDexTitle]; }
    }
  }

  return '';
}


async function mapMalData(malData) {
  //Gets mal_ids and finds corresponding manga_ids on mangadex.
  const toReturn = [];
  let counter = 0;

  for (const info of malData) {
    const title = info[0], malId = info[1];
    const res = await getMangaIdFromMal(title, malId);
    if (res) {
      toReturn.push(res);
      counter++;
    }
    else { console.log('getMangaIdsFromMal failed', title, malId); }
  }
  console.log(`Mangas matched from MAL: ${counter}/${malData.length}`);
  return toReturn;
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
  getMangaTitle, aggregateMangaChapters, mapMalData
};


