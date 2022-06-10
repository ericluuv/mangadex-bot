require('dotenv').config();
const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageButton, MessageEmbed } = require('discord.js');
const paginationEmbed = require('discordjs-button-pagination');
const { formatOptions } = require('./options.js');

const {
  updateMangaList, createList, getFieldsFromMangaIds,
  getMangaIdsFromList, getListData, getMangaTitle
} = require('./manga/mgExport.js');


const {
  insertFollow, delFollow, getGuildRow, getMangaCount,
  updateChannelId, insertGuildRow, getFollowedMangas, getGuildTable
} = require('./postgres/psExport.js');


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


async function getCurrentCommands() {
  //Gets names of all global commands.
  const options = formatOptions('GET', `Bot ${process.env.DISCORD_TOKEN}`);

  const res = await fetch(global_url, options).catch(err => console.log(err));
  const json = await res.json();
  return json.map(command => command.name);
}


async function createCommands() {
  //Creates commands if they are not already made.
  const currents = await getCurrentCommands();
  for (const command of commands) {
    if (currents.includes(command.name)) { continue; }
    const options = formatOptions('POST', `Bot ${process.env.DISCORD_TOKEN}`, command.toJSON());
    const response = await fetch(global_url, options);
    console.log(await response.json());
  }
  console.log('Commands created');
}


async function checkGuild(interaction) {
  //Returns true if guild is in db, false if not. Also edits reply.
  const guildId = interaction.guild.id;
  const res = await getGuildRow(guildId).then(res => Boolean(res?.length || 0));
  if (!res) { await interaction.editReply({ content: 'Channel has not been set, use /set to do so.' }); }
  return res;
}


async function parseUrl(interaction, choice) {
  //Returns relevant ID if interaction contains a valid Url, empty string if not. Also edits reply.
  const input = interaction.options.getString('url');
  if (choice === 'manga') { 
    const res = input.slice(0, 27);
    if (res === 'https://mangadex.org/title/') { return input.slice(27).split('/')[0]; }
    else { await interaction.editReply({content: 'Invalid URL.'}); }
  }
  else if (choice === 'list') {
    const res = input.slice(0, 26);
    if (res === 'https://mangadex.org/list/') { return input.slice(26).split('/')[0]; }
    else { await interaction.editReply({content: 'Invalid URL.'}); }
  }
  else if (choice === 'mal') {
    
  }
  else {
    await interaction.editReply({content: 'Internal error in parseUrl.'});
    console.log('Invalid choice inputted for checkUrl', choice);
  }
  return '';
}


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
    const mangaCount = await getMangaCount(mangaId);
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
  const guildStatus = await checkGuild(interaction);
  if (!guildStatus) { return; }

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

module.exports = {
  createCommands,
  handleFollowCommand,
  handleUnfollowCommand,
  handleSetCommand,
  handleListCommand,
  handleMigrateCommand
};

