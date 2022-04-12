require('dotenv').config();
const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('@discordjs/builders');

const { updateMangaList, getTitleInfo, createList } = require('./manga.js');

const { 
  insertFollow, delFollow, getGuildRow, getMangaCount, getGuildTable,
  updateChannelId, insertGuildRow
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

const commands = [followCommand, unfollowCommand, setChannelCommands, listMangaCommands];

const global_url = `https://discord.com/api/v8/applications/${process.env.APPLICATION_STAGING_ID}/commands`;

function getCurrentCommands() {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_STAGING_TOKEN}`,
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
        'Authorization': `Bot ${process.env.DISCORD_STAGING_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    const response = await fetch(global_url, options);
    console.log(await response.json());
  }
  console.log('Commands created');
}

async function handleAddCommand(interaction) {
  const info = getTitleInfo(interaction.options);
  const mangaId = info[0];
  const mangaTitle = info[1];
  let verb, method;
  if (interaction.commandName === 'add') {
    verb = 'added';
    method = 'POST';
  }
  else {
    verb = 'deleted';
    method = 'DELETE';
  }
  /*
  const userId = interaction.user.id;
  bot.channels.cache.get(process.env.CHANNEL_STAGING_ID).send({
    content: `<@${userId}> `
  });*/
  const res = await updateMangaList(mangaId, method);
  if (res.result === 'ok') {
    await interaction.deferReply();
    await interaction.editReply({
      content: `Successfully ${verb} ${mangaTitle} <:dababy:827023206631866428>`
    });
  }
  else {
    console.log('Failed', res);
    await interaction.reply({
      content: `Error!`
    });
  }
}


async function handleFollowCommand(interaction) {
  await interaction.deferReply();
  const info = getTitleInfo(interaction.options);
  const userId = interaction.user.id;
  const mangaId = info[0];
  const mangaTitle = info[1];
  const guildId = interaction.guild.id;
  const listId = (await getGuildRow(guildId))[0]?.list_id;
  if (mangaId === '') {
    await interaction.editReply({content: 'Invalid URL.'});
    return;
  }

  const status = await updateMangaList(mangaId, listId, 'POST');
  if (status !== 'ok') { 
    await interaction.editReply({content: 'Mangadex API error with the list.'});
  }
  else {
    const res = await insertFollow(userId, mangaId, guildId);
    if (res) { 
      await interaction.editReply({content: `Now following ${mangaTitle}`});
    }
    else {
      await interaction.editReply({content: `Already following ${mangaTitle}`});
    }
  }
}

async function handleUnfollowCommand(interaction) {
  await interaction.deferReply();
  const info = getTitleInfo(interaction.options);
  const userId = interaction.user.id;
  const mangaId = info[0];
  const mangaTitle = info[1];
  const guildId = interaction.guild.id;

  if (mangaId === '') { 
    await interaction.editReply({content: `URL was invalid.`});
    return;
  }
  const count = await delFollow(userId, mangaId, guildId);
  if (count === 0) { 
    await interaction.editReply({content: `Wasn't even following ${mangaTitle}`});
  }
  else {
    const mangaCount = await getMangaCount(mangaId);
    console.log('THE MANGA COUNT', mangaCount);
    if (mangaCount === '0') {
      const listId = (await getGuildRow(guildId))?.[0]?.list_id;
      await updateMangaList(mangaId, listId, 'DELETE');
      console.log(`${mangaTitle} was deleted from list: ${listId}`);
    }
    await interaction.editReply({content: `No longer following ${mangaTitle}`});
  }
}

async function handleSetCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;
  const guilds = (await getGuildTable()).map((elem) => {
    return elem.guild_id;
  });
  console.log('curr guildId, channelIds, and all guilds', guildId, channelId, guilds);

  if (guilds.includes(guildId)) {
    await updateChannelId(guildId, channelId);
  }
  else {
    const listId = await createList('botList' + 1);
    if (typeof(listId) != 'undefined') { insertGuildRow(guildId, listId, channelId); }
  }
  await interaction.editReply({content: 'Channel Successfuly Set'});
}


module.exports = {
  createCommands,
  handleFollowCommand,
  handleUnfollowCommand,
  handleSetCommand
};
