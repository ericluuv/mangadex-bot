const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkGuild, parseUrl } = require('./helper.js');
const { getGuildRow, insertFollow, getFollowedMangas } = require('../postgres/psExport.js');
const { getListData, getMangaIdsFromList, updateMangaList } = require('../manga/mgExport.js');
const { getMalData } = require('../manga/mgExport.js');
const { mapMalData } = require('../manga/manga.js');


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
  if (!guildStatus || !listId) { return; }
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  let listTitle;
  const serverListId = (await getGuildRow(guildId))?.[0]?.list_id;
  const currFollowedMangas = await getFollowedMangas(guildId, userId);
  let mangasToMigrate;
  if (listId.length === 36) { 
    mangasToMigrate = await getMangaIdsFromList(listId);
    listTitle = (await getListData(listId))?.attributes?.name || 'Unknown Title';
  }
  else {
    //Mal username
    const malData = await getMalData(listId);
    const res = await mapMalData(malData);
    mangasToMigrate = res[0];
    await interaction.channel.send({ content: res[1] });
    listTitle = listId;
  }
  mangasToMigrate = mangasToMigrate.filter(mangaId => !(currFollowedMangas.includes(mangaId)));

  await interaction.editReply({ content: `Migrating ${mangasToMigrate.length} mangas...` });
  for (const mangaId of mangasToMigrate) {
    await updateMangaList(mangaId, serverListId, 'POST');
    await insertFollow(userId, mangaId, guildId);
  }

  await interaction.editReply({ content: `Migrated ${mangasToMigrate.length} mangas from ${listTitle}.` });
}

module.exports = { migrateCommand, handleMigrateCommand };