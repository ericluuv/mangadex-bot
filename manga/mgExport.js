const { createList, getListData, updateMangaList, 
  getMangaIdsFromList, getListUpdates
 } = require('./list.js');
const { getAuthorName} = require('./helper.js');
const {getMangaTitle } = require('./manga.js');
const { processUpdates } = require('./updates.js');


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