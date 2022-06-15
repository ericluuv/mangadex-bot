const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkGuild, parseUrl } = require('./helper.js');
const { getGuildRow, delFollow, getMangaCount } = require('../postgres/psExport.js');
const { getMangaTitle, updateMangaList } = require('../manga/mgExport.js');


const unfollowCommand = new SlashCommandBuilder()
  .setName('unfollow')
  .setDescription('Unfollow mangas via URL.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga').setRequired(true);
  });


async function handleUnfollowCommand(interaction) {
  await interaction.deferReply();
  const guildStatus = await checkGuild(interaction);
  const mangaId = await parseUrl(interaction, 'manga');
  if (!guildStatus || mangaId === '') { return; }
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const mangaTitle = await getMangaTitle(mangaId);

  const count = await delFollow(userId, mangaId, guildId);
  if (count === 0) {
    await interaction.editReply({ content: `Wasn't even following ${mangaTitle || mangaId}` });
  }
  else {
    const mangaCount = await getMangaCount(mangaId, guildId);
    if (mangaCount === '0') {
      const listId = (await getGuildRow(guildId))?.[0]?.list_id;
      const res = await updateMangaList(mangaId, listId, 'DELETE');
      if (res === 'ok') { console.log(`${mangaTitle || mangaId} was deleted from list: ${listId}`) }
      else {
        console.log('Error with list');
      }
    }
    await interaction.editReply({ content: `No longer following ${mangaTitle || mangaId}` });
  }
}

module.exports = { unfollowCommand, handleUnfollowCommand };