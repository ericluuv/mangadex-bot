const { formatOptions } = require('../options.js');
const { getMangaData, getAuthorName, getCoverFileName } = require('./helper.js');
const { getMangaDataRow, updateMangaTitle, checkLimit } = require('../postgres/psExport.js');
const fetch = require('node-fetch');
const path = require('path');
const { getMalTitle } = require('./mal.js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


async function getMangaTitle(mangaId, mangaData = '', update = true) {
  //Queries table for mangaTitle. If not there, gets it from mangadex.
  if (mangaId) {
    const res = await getMangaDataRow(mangaId);
    if (res?.manga_title) { return res?.manga_title; }
  }
  if (!mangaData) { mangaData = await getMangaData('', mangaId); }
  mangaId = mangaData?.id;

  let mangaTitle = mangaData?.attributes?.title;
  mangaTitle = mangaTitle?.en || mangaTitle?.ja || mangaTitle?.['ja-ro'] || 'Unknown Title';
  if (update) { await updateMangaTitle(mangaId, mangaTitle); }

  return mangaTitle;
}


async function malIdToMD(title, malId) {
  //Grabs mangaId on mangadex from malIds
  if (!title) { title = await getMalTitle(malId); }
  const url = `${process.env.MANGADEX_URL}/manga?limit=50&title=${title}?&includes[]=author`;
  const options = formatOptions('GET');

  await checkLimit();
  const res = await fetch(url, options);
  const json = await res.json();
  if (json?.result === 'ok') {
    for (const mangaData of json?.data) {
      const malMatch = mangaData?.attributes?.links?.mal === malId;
      const mangaDexTitle = await getMangaTitle(mangaData?.id, mangaData, false);
      const titleMatch = mangaDexTitle === title;
      if (malMatch || titleMatch) {
        console.log(`mal: ${malId} = MD: ${mangaData?.id}, title = ${mangaDexTitle}`);
        return mangaData?.id;
      }
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
    const res = await malIdToMD(title, malId);
    if (res) {
      toReturn.push(res);
      counter++;
    }
  }
  const status = `Mangas matched from MAL: ${counter}/${malData.length}`;
  return [toReturn, status];
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


async function getRandomManga() {
  //Returns manga returned from the random endpoint.
  const url = `${process.env.MANGADEX_URL}/manga/random?includes[]=author&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`;
  const options = formatOptions('GET');
  await checkLimit();
  const res = await fetch(url, options);
  const json = await res.json();
  const mangaData = json?.data;
  const mangaTitle = await getMangaTitle('', mangaData, false);
  const authorName = await getAuthorName(mangaData, '', false);
  const coverFileName = await getCoverFileName(mangaData);
  const thumbnailUrl = `https://uploads.mangadex.org/covers/${mangaData?.id}/${coverFileName}`;
  const contentRating = mangaData?.attributes?.contentRating || 'Unknown';
  let tagStr = '';
  for (const tag of mangaData?.attributes?.tags.slice(0, 10)) {
    tagStr += `${tag?.attributes?.name?.en}\n`;
  }

  const embed = {
    'title': `${mangaTitle}`,
    'description': `Author: ${authorName}\nContent Rating: ${contentRating}\n${tagStr}`,
    'color': 16742144,
    'footer': { 'text': 'Rando' },
    'url': `https://mangadex.org/title/${mangaData?.id}`,
    'thumbnail': { 'url': thumbnailUrl }
  };
  console.log(tagStr);
  return embed;
}

module.exports = {
  getMangaTitle, aggregateMangaChapters, mapMalData, malIdToMD, getRandomManga
};



