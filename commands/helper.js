const { getGuildRow } = require('.././postgres/psExport.js');
const { malIdToMD } = require('../manga/mgExport.js');

async function checkGuild(interaction) {
  //Returns true if guild is in db, false if not. Also edits reply.
  const guildId = interaction.guild.id;
  const res = await getGuildRow(guildId).then(res => Boolean(res?.length || 0));
  if (!res) { await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' }); }
  return res;
}


function parseMDList(url) {
  //Returns list id from mangadex.
  const listUrl = url.slice(0, 26) === 'https://mangadex.org/list/';
  const listId = url.slice(26).split('/')[0];
  if (listUrl && listId && listId.length === 36) { return listId; }
}

function parseMDManga(url) {
  const mangaUrl = url.slice(0, 27) === 'https://mangadex.org/title/';
  const mangaId = url.slice(27).split('/')[0];
  if (mangaUrl && mangaId && mangaId.length === 36) { return mangaId; }
}

function parseMalList(url) {
  //Returns username from mal links.
  const profileUrl = url.slice(0, 32) === 'https://myanimelist.net/profile/';
  const listUrl = url.slice(0, 34) === 'https://myanimelist.net/mangalist/';
  const profileMalUser = url.slice(32).split('?')[0];
  const listMalUser = url.slice(34).split('?')[0];
  if (profileUrl && profileMalUser) { return profileMalUser; }
  if (listUrl && listMalUser) { return listMalUser; }
}

function parseMalManga(url) {
  //Returns malMangaId from mal links.
  const mangaUrl = url.slice(0, 30) === 'https://myanimelist.net/manga/';
  const mangaId = url.slice(30).split('/')[0];
  if (mangaUrl && mangaId) { return mangaId; }
}


async function parseUrl(interaction, choice) {
  //Checks for both MAL and MD urls and returns one if possible.
  const input = interaction.options.getString('url');
  let id;
  if (choice === 'manga') {
    id = parseMDManga(input);
    id = id || parseMalManga(input);
    if (id && id.length !== 36) {
      id = await malIdToMD('', id);
      if (!id) { await interaction.editReply({content: 'No MangaDex Equivalent'}); }
      return id;
    }
  }
  else if (choice === 'list') {
    id = parseMDList(input);
    id = id || parseMalList(input);
  }
  else {
    await interaction.editReply({ content: 'Internal error in parseUrl' });
    console.log(input, choice);
    return '';
  }
  if (id) { return id; }
  await interaction.editReply({ content: 'Invalid URL.' });
}



module.exports = { checkGuild, parseUrl };
