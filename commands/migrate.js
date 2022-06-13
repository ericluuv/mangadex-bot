const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkGuild, parseUrl } = require('./helper.js');
const { getGuildRow, insertFollow } = require('../postgres/psExport.js');
const { getListData, getMangaIdsFromList, updateMangaList } = require('../manga/mgExport.js');


const migrateCommand = new SlashCommandBuilder()
  .setName('migrate')
  .setDescription('Migrates a public list of mangas to the server list.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga list').setRequired(true);
  });


async function handleMigrateCommand(interaction) {
  await interaction.deferReply();
  const guildStatus = await checkGuild(interaction);
  const listId = await parseUrl(interaction, 'list');
  if (!guildStatus || listId === '') { return; }
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const listTitle = (await getListData(listId))?.attributes?.name || 'Unknown Title';
  const serverListId = (await getGuildRow(guildId))?.[0]?.list_id;
  const currMangas = await getMangaIdsFromList(serverListId);
  const mangaIds = (await getMangaIdsFromList(listId)).filter(mangaId => {
    return !(currMangas.includes(mangaId));
  });

  await interaction.editReply({ content: `Migrating ${mangaIds.length} mangas...` });
  for (const mangaId of mangaIds) {
    await updateMangaList(mangaId, serverListId, 'POST');
    await insertFollow(userId, mangaId, guildId);
  }

  await interaction.editReply({ content: `Migrated ${mangaIds.length} mangas from ${listTitle} to server list.` });
}

module.exports = { migrateCommand, handleMigrateCommand };