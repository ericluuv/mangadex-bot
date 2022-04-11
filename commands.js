require('dotenv').config();
const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('@discordjs/builders');

const { updateMangaList, getTitleInfo } = require('./manga.js');

const { updateChannelId } = require('./postgres.js');

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

async function getCurrentCommands() {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_STAGING_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  const response = await fetch(global_url, options);
  const json = await response.json();
  const toReturn = new Set();
  for (const command of json) { toReturn.add(command.name); }
  return toReturn;
}

async function createCommands() {
  const currents = await getCurrentCommands();
  for (const command of commands) {
    if (currents.has(command.name)) { continue; }
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

async function handleFollowCommand(interaction) {
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

async function handleSetCommand(interaction) {
  await interaction.deferReply();
  const channelId = interaction.channel.id;
  const guildId = interaction.guild.id;
  updateChannelId(guildId, channelId);
  await interaction.editReply({
    content: `Manga updates will now be sent to this channel`
  });
}

module.exports = {
  createCommands,
  handleFollowCommand
};

