const { parseMDManga } = require('./helper.js');
const { getGuildRow, insertFollow } = require('../postgres/psExport.js');
const { getMangaTitle, updateMangaList } = require('../manga/mgExport.js');

async function jarvis(msg, text) {
  const guildId = msg.guild.id;
  const userId = msg.author.id;
  const temp = text.split(' ')[2];
  console.log(temp, text.split(' '));
  if (temp) {
    const mangaId = parseMDManga(temp);
    if (!mangaId) {
      await msg.channel.send({ content: `Sir, that's not a valid link.` });
      return;
    }
    const mangaTitle = await getMangaTitle(mangaId);
    const listId = (await getGuildRow(guildId))[0]?.list_id;

    const status = await updateMangaList(mangaId, listId, 'POST');
    if (status !== 'ok') {
      await msg.channel.send({ content: 'Mangadex API error with the list.' });
    }
    else {
      const res = await insertFollow(userId, mangaId, guildId);
      if (res === 1) {
        await msg.channel.send({ content: `Sir, now following ${mangaTitle || mangaId}` });
      }
      else {
        await msgchannel.send({ content: `Sir, already following ${mangaTitle || mangaId}` });
      }
    }
  }

}


module.exports = { jarvis };