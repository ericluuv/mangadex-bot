const { formatOptions } = require('../options.js');
const { getMangaData } = require('./helper.js');
const { getMangaDataRow, updateMangaTitle, checkLimit } = require('../postgres/psExport.js');
const fetch = require('node-fetch');


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


async function getMangaIdsFromMal(malData) {
  //Gets mal_ids and finds corresponding manga_ids on mangadex.
  const toReturn = [];
  let counter = 0;

  for (const info of malData) {
    const title = info[0], malId = info[1];
    const url = `${process.env.MANGADEX_URL}/manga?limit=50&title=${title}`;
    const options = formatOptions('GET');

    await checkLimit();
    const res = await fetch(url, options);
    const json = await res.json();

    if (json?.result === 'ok') {
      for (const mangaData of json?.data) {
        const malMatch = mangaData?.attributes?.links?.mal == malId;
        const titleMatch = mangaData?.attributes?.title?.en === title;

        if (malMatch || titleMatch) {
          toReturn.push(mangaData?.id);
          counter++;
          break;
        }
      }
    }
    else { console.log('getMangaIdsFromMal failed', json); }
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
  getMangaTitle, aggregateMangaChapters, getMangaIdsFromMal
};
