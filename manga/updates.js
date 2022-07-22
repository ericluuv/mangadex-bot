const { getScanGroup, getAuthorName, getCoverFileName, getRelId, getMangaData } = require('./helper.js');
const { getMangaTitle, aggregateMangaChapters } = require('./manga.js');


async function filterUpdates(updates) {
  //Return chapters that have no duplicates.
  const toReturn = [];
  for (const update of updates) {
    const mangaId = getRelId(update?.relationships, 'manga');
    const existingChapters = await aggregateMangaChapters(mangaId);
    const chapter = update?.attributes?.chapter || '?';
    console.log("Result after aggregation", existingChapters, chapter);

    if (existingChapters[chapter] === 1) { toReturn.push(update); }
    else {
      console.log('Update that was filered out, existing chapter\n', update);
    }
  }
  return toReturn;
}


async function processUpdates(updates) {
  //Returns the updates in an embed format for discord.
  const procUpdates = await filterUpdates(updates);
  const toReturn = [];
  for (const update of procUpdates) {
    const mangaData = await getMangaData(update);
    const mangaTitle = await getMangaTitle('', mangaData);
    const scanGroup = (await getScanGroup(update)) || 'Unknown Group';
    const authorName = await getAuthorName(mangaData, mangaData?.id);
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

module.exports = {
  processUpdates
};
