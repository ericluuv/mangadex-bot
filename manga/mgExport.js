const { createList, getListData, updateMangaList, 
  getMangaIdsFromList, getListUpdates
 } = require('./list.js');
const { getScanGroup, getAuthorName, getCoverFileName, getMangaData } = require('./helper.js');


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

module.exports = {
  createList, getListData, updateMangaList, getMangaIdsFromList,
  processUpdates, getFieldsFromMangaIds, getListUpdates, getMangaData
}