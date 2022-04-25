require('dotenv').config();
const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageButton, MessageEmbed } = require('discord.js');
const paginationEmbed = require('discordjs-button-pagination');

const {
  updateMangaList, getMangaId, createList, getFieldsFromMangaIds,
  getMangaIdsFromList, getListId, getMangaData, getListData
} = require('./manga.js');


const {
  insertFollow, delFollow, getGuildRow, getMangaCount,
  updateChannelId, insertGuildRow, getFollowedMangas, getGuildTable
} = require('./postgres/postgres.js');


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

  return fetch(global_url, options).then(res => res.json()).then(json => {
    return json.map(command => command.name);
  }).catch(err => console.log(err));
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
  const userId = interaction.user.id;
  const mangaId = getMangaId(interaction.options);
  const mangaTitle = (await getMangaData('', mangaId))?.attributes?.title?.en || 'Unknown Title';
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
    if (res === 1) {
      console.log(`${mangaTitle || mangaId} was inserted into list: ${listId}`);
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
  const userId = interaction.user.id;
  const mangaId = getMangaId(interaction.options);
  const mangaTitle = (await getMangaData('', mangaId))?.attributes?.title?.en || 'Unknown Title';
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
  await interaction.editReply({ content: `Processing ${mangaIds.length} mangas...` });
  const fields = await getFieldsFromMangaIds(mangaIds);
  const groupedFields = [];
  for (let i = 0; i < fields.length; i += 10) {
    groupedFields.push(fields.slice(i, i + 10));
  }

  const button1 = new MessageButton()
  .setCustomId("previousbtn")
  .setStyle("SECONDARY")
  .setEmoji('⏮️');

  const button2 = new MessageButton()
    .setCustomId("nextbtn")
    .setStyle("SECONDARY")
    .setEmoji('⏭️');


  let counter = 0;
  const embeds = groupedFields.map(groupedField => {
    counter += groupedField.length;
    return new MessageEmbed()
      .setTitle(`${interaction.user.username}'s List`)
      .setDescription(`${counter} / ${fields.length}`)
      .setFields(groupedField);
  })
  await interaction.editReply({ content: 'Done!' });
  if (embeds.length === 0) {
    await interaction.channel.send({ content: 'Following 0 Mangas' });
  }
  else {
    await paginationEmbed(interaction, embeds, [button1, button2], 60000);
  }
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
  const listId = getListId(interaction.options);
  if (listId === '') {
    await interaction.editReply({ content: 'Invalid URL.' });
    return;
  }
  const listTitle = (await getListData(listId))?.attributes?.name || 'Unkown Title';
  const mangaIds = await getMangaIdsFromList(listId);
  const newListId = (await getGuildRow(guildId))?.[0]?.list_id;

  await interaction.editReply({ content: `Migrating ${mangaIds.length} mangas...` });
  for (const mangaId of mangaIds) {
    await Promise.all([updateMangaList(mangaId, newListId, 'POST'),
    insertFollow(userId, mangaId, guildId)]);
  }

  await interaction.editReply({ content: `Migrated ${mangaIds.length} mangas from ${listTitle} to server list.` });
}

module.exports = {
  createCommands,
  handleFollowCommand,
  handleUnfollowCommand,
  handleSetCommand,
  handleListCommand,
  handleMigrateCommand
};
