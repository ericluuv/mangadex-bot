const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkGuild, parseUrl } = require('./helper.js');
const { getGuildRow, insertFollow } = require('../postgres/psExport.js');
const { getMangaTitle, updateMangaList } = require('../manga/mgExport.js');


const followCommand = new SlashCommandBuilder()
.setName('follow')
.setDescription('Follows manga via URL.')
.addStringOption((option) => {
  return option.setName('url')
    .setDescription('The URL of the manga').setRequired(true);
});


async function handleFollowCommand(interaction) {
  await interaction.deferReply();
  const guildStatus = await checkGuild(interaction);
  const mangaId = await parseUrl(interaction, 'manga');
  if (!guildStatus || mangaId === '') { return; }
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const mangaTitle = await getMangaTitle(mangaId);
  const listId = (await getGuildRow(guildId))[0]?.list_id;

  const status = await updateMangaList(mangaId, listId, 'POST');
  if (status !== 'ok') {
    await interaction.editReply({ content: 'Mangadex API error with the list.' });
  }
  else {
    const res = await insertFollow(userId, mangaId, guildId);
    if (res === 1) {
      await interaction.editReply({ content: `Now following ${mangaTitle || mangaId}` });
    }
    else {
      await interaction.editReply({ content: `Already following ${mangaTitle || mangaId}` });
    }
  }
}

module.exports = { followCommand, handleFollowCommand };