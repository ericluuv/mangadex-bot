const { getGuildRow } = require('.././postgres/psExport.js');

async function checkGuild(interaction) {
  //Returns true if guild is in db, false if not. Also edits reply.
  const guildId = interaction.guild.id;
  const res = await getGuildRow(guildId).then(res => Boolean(res?.length || 0));
  if (!res) { await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' }); }
  return res;
}


// https://myanimelist.net/mangalist/manga_bot
// https://myanimelist.net/mangalist/manga_bot?status=1
// https://myanimelist.net/profile/manga_bot
function parseMangaDex(url) {

}


function parseMal(url) {
  
}

async function parseUrl(interaction, choice) {
  //Returns relevant ID if interaction contains a valid Url, empty string if not. Also edits reply.
  const input = interaction.options.getString('url');
  if (choice === 'manga') {
    const res = input.slice(0, 27);
    if (res === 'https://mangadex.org/title/') {
      const id = input.slice(27).split('/')[0];
      if (id.length === 36) { return id; }
    }
  }
  else if (choice === 'list') {
    const res = input.slice(0, 26);
    if (res === 'https://mangadex.org/list/') {
      const id = input.slice(26).split('/')[0];
      if (id.length === 36) { return id; }
    }
  }
  else if (choice === 'mal') {

  }
  else {
    await interaction.editReply({ content: 'Internal error in parseUrl.' });
    console.log('Invalid choice inputted for checkUrl', choice, input);
    return '';
  }
  await interaction.editReply({ content: 'Invalid URL.' });
  return '';
}

module.exports = { checkGuild, parseUrl };
