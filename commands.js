require('dotenv').config();
const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('@discordjs/builders');

const { 
  updateMangaList, getTitleInfo, createList, getMangaEmbeds, 
  getMangaIdsFromList, getListId
} = require('./manga.js');

const {
  insertFollow, delFollow, getGuildRow, getMangaCount, getSessionToken,
  updateChannelId, insertGuildRow, getFollowedMangas, getGuildTable
} = require('./postgres.js');

const followCommand = new SlashCommandBuilder()
  .setName('follow')
  .setDescription('Follows manga via URL.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga').setRequired(true);
  });

const unfollowCommand = new SlashCommandBuilder()
  .setName('unfollow')
  .setDescription('Unfollow mangas via URL.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga').setRequired(true);
  });

const setChannelCommands = new SlashCommandBuilder()
  .setName('set')
  .setDescription('Sets the current channel as the location for manga updates.')
  ;

const listMangaCommands = new SlashCommandBuilder()
  .setName('list')
  .setDescription('Lists manga the user is currently folllowing')
  ;

const migrateCommand = new SlashCommandBuilder()
  .setName('migrate')
  .setDescription('Migrates a public list of mangas to the server list.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga list').setRequired(true);
  });

const commands = [followCommand, unfollowCommand, setChannelCommands, listMangaCommands, migrateCommand];

const global_url = `https://discord.com/api/v8/applications/${process.env.APPLICATION_ID}/commands`;

function getCurrentCommands() {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  return fetch(global_url, options).then(async res => {
    const json = await res.json();
    return json.map(command => command.name);
  })
    .catch(err => console.log(err));
}

async function createCommands() {
  const currents = await getCurrentCommands();
  for (const command of commands) {
    if (currents.includes(command.name)) { continue; }
    const options = {
      method: 'POST',
      body: JSON.stringify(command.toJSON()),
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    const response = await fetch(global_url, options);
    console.log(await response.json());
  }
  console.log('Commands created');
}


function checkGuild(guildId) {
  //Returns true if the guild exists in the table, false if not.
  return getGuildRow(guildId).then(res => Boolean(res?.length || 0));
}


async function handleFollowCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const info = getTitleInfo(interaction.options);
  const userId = interaction.user.id;
  const mangaId = info[0];
  const mangaTitle = info[1];
  const guildStatus = await checkGuild(guildId);
  if (mangaId === '') {
    await interaction.editReply({ content: 'Invalid URL.' });
    return;
  }
  if (!guildStatus) {
    await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' });
    return;
  }
  const listId = (await getGuildRow(guildId))[0]?.list_id;

  const status = await updateMangaList(mangaId, listId, 'POST');
  if (status !== 'ok') {
    await interaction.editReply({ content: 'Mangadex API error with the list.' });
  }
  else {
    const res = await insertFollow(userId, mangaId, guildId);
    if (res) {
      await interaction.editReply({ content: `Now following ${mangaTitle || mangaId}` });
    }
    else {
      await interaction.editReply({ content: `Already following ${mangaTitle || mangaId}` });
    }
  }
}

async function handleUnfollowCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const info = getTitleInfo(interaction.options);
  const userId = interaction.user.id;
  const mangaId = info[0];
  const mangaTitle = info[1];
  const guildStatus = await checkGuild(guildId);
  if (mangaId === '') {
    await interaction.editReply({ content: 'Invalid URL.' });
    return;
  }
  if (!guildStatus) {
    await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' });
    return;
  }

  const count = await delFollow(userId, mangaId, guildId);
  if (count === 0) {
    await interaction.editReply({ content: `Wasn't even following ${mangaTitle || mangaId}` });
  }
  else {
    const mangaCount = await getMangaCount(mangaId);
    console.log('THE MANGA COUNT', mangaCount);
    if (mangaCount === '0') {
      const listId = (await getGuildRow(guildId))?.[0]?.list_id;
      await updateMangaList(mangaId, listId, 'DELETE');
      console.log(`${mangaTitle || mangaId} was deleted from list: ${listId}`);
    }
    await interaction.editReply({ content: `No longer following ${mangaTitle || mangaId}` });
  }
}

async function handleSetCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;
  const guilds = (await getGuildTable()).map(row => row.guild_id);

  if (guilds.includes(guildId)) {
    await updateChannelId(guildId, channelId);
  }
  else {
    const listId = await createList('botList' + (guilds.length + 1));
    if (typeof (listId) != 'undefined') { insertGuildRow(guildId, listId, channelId); }
  }
  await interaction.editReply({ content: 'Channel Successfuly Set' });
}

async function handleListCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const guildStatus = await checkGuild(guildId);
  if (!guildStatus) {
    await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' });
    return;
  }

  const mangaIds = await getFollowedMangas(guildId, userId);
  const embeds = await Promise.all(await getMangaEmbeds(mangaIds));

  await interaction.editReply({ content: `Getting ${embeds.length} Mangas` });
  await Promise.all(embeds.map(embed => interaction.channel.send(embed)));
}

async function handleMigrateCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const guildStatus = await checkGuild(guildId);
  if (!guildStatus) { 
    await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' });
    return;
  }

  const listInfo = getListId(interaction.options);
  const listId = listInfo[0];
  const listTitle = listInfo[1];
  console.log('the old listId', listId);
  const mangaIds = await getMangaIdsFromList(listId);
  const newListId = await getGuildRow(guildId)?.[0]?.guild_id;
  console.log('new list Id', newListId)
  await interaction.editReply({content: `Migrating ${mangaIds.length} from ${listTitle} to server list.`});
  await getSessionToken(); // So all the upcoming requests have an updated token.
  await Promise.all(mangaIds.map(mangaId => {
    return updateMangaList(mangaId, newListId, 'POST')
  }));
  await Promise.all(mangaIds.map(mangaId => {
    return insertFollow(userId, mangaId, guildId);
  }));
}

module.exports = {
  createCommands,
  handleFollowCommand,
  handleUnfollowCommand,
  handleSetCommand,
  handleListCommand,
  handleMigrateCommand
};
