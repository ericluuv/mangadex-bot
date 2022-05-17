const { getScanGroup, getAuthorName, getCoverFileName, getRelId } = require('./helper.js');
const { getMangaData, getMangaTitle, aggregateMangaChapters } = require('./manga.js');
let previous = [];


async function filterUpdates(updates) {
  //Return chapters that are unique and aren't already posted in the manga.
  const toReturn = [], currUpdates = [];
  for (const update of updates) {
    if (previous.includes(update?.id) || currUpdates.includes(update?.id)) {
      console.log('Update filtered out, previously sent\n', update);
      continue;
    }
    currUpdates.push(update?.id);

    const mangaId = getRelId(update?.relationships, 'manga');
    const existingChapters = await aggregateMangaChapters(mangaId);
    const chapter = update?.attributes?.chapter || '?';

    if (existingChapters[chapter] === 1) { toReturn.push(update); }
    else {
      console.log('Update that was filered out, existing chapter\n', update);
    }
  }
  previous = currUpdates;
  return toReturn;
}


async function processUpdates(updates) {
  //Returns the updates in an embed format for discord.
  updates = await filterUpdates(updates);
  const toReturn = [];
  for (const update of updates) {
    const mangaData = await getMangaData(update);
    const mangaTitle = await getMangaTitle(mangaData?.id);
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
