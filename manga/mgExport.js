const { createList, getListData, updateMangaList, 
  getMangaIdsFromList, getListUpdates
 } = require('./list.js');
const { getScanGroup, getAuthorName, getCoverFileName, getMangaTitle, getMangaData } = require('./helper.js');


async function processUpdates(updates) {
  //Returns the updates in an embed format for discord.
  const toReturn = [];
  for (const update of updates) {
    const mangaData = await getMangaData(update);
    const mangaTitle = await getMangaTitle(mangaData);
    const scanGroup = (await getScanGroup(update)) || 'Unknown Group';
    const authorName = await getAuthorName(mangaData);
    const coverFileName = await getCoverFileName(mangaData);
    const thumbnailUrl = `https://uploads.mangadex.org/covers/${mangaData?.id}/${coverFileName}`;
    const chapter = update?.attributes?.chapter || '?';
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
  const fields = [];
  for (const mangaId of mangaIds) {
    const authorName = await getAuthorName('', mangaId);
    const mangaTitle = await getMangaTitle('', mangaId);
    const temp = {
      'name': `${mangaTitle}`,
      'value': `Author: ${authorName}
      [MangaDex Link](https://mangadex.org/title/${mangaId}/)`,
    };
    fields.push(temp);
  }
  return fields;
}

module.exports = {
  createList, getListData, updateMangaList, getMangaIdsFromList,
  processUpdates, getFieldsFromMangaIds, getListUpdates, getMangaTitle
};