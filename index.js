"use strict";

require('dotenv').config();
// discord API
const Discord = require('discord.js');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES"] });
bot.login(process.env.DISCORD_TOKEN);

// request API
const fetch = require('node-fetch');

// postgreSQL API
const { Pool, Client } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.connect().then(console.log('PostgreSQL connected.'));

//Session & Refresh token table
const makeMangaTable = 'CREATE TABLE IF NOT EXISTS dex_tokens ( \
  da_key BIGINT PRIMARY KEY,  \
  session_token TEXT,         \
  refresh_token TEXT,         \
  session_date BIGINT,        \
  refresh_date BIGINT         \
  )';

pool.query(makeMangaTable, (err, res) => {
  if (err) { console.log(err); }
  else { console.log('dex_tokens table made successfully'); }
});




//MagnaDex Stuff
const mangadex_url = "https://api.mangadex.org";
const listId = 'a1c6b4c7-d6cc-4a82-97a7-506825bf81c4';
const { getTitleInfo, updateMangaList } = require('./manga.js');


bot.on('ready', () => {

  let commands;
  const guild = bot.guilds.cache.get(process.env.GUILD_ID);
  if (guild) { commands = guild.commands; }
  else { commands = bot.application?.commands; }
  commands.create(addCommand);
  commands.create(delCommand);
  console.log('Commands created');

  console.log("Mangadex-bot logged in");
  bot.user.setActivity('Doki Doki Literature Club', {type: 'PLAYING'});
});


//Eric functions
bot.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
  
  if (interaction.commandName === 'add' || interaction.commandName === 'delete') {
    const info = getTitleInfo(interaction.options);
    const mangaId = info[0];
    const mangaTitle = info.length > 1 ? info[1] : 'Unknown';
    let verb, method;
    if (interaction.commandName === 'add') {
      verb = 'added';
      method = 'POST';
    }
    else {
      verb = 'deleted';
      method = 'DELETE';
    }
    const res = await updateMangaList(mangaId, method, pool);
    if (res.result === 'ok') { 
      await interaction.deferReply();
      await interaction.reply({
        content: `Successfully ${verb} ${mangaTitle} <:dababy:827023206631866428>`
      });
    }
    else {
      await interaction.reply({
        content: `Error!`
      });
    }
  }
  /*
	if (interaction.commandName === 'add') {
    const info = getTitleInfo(interaction.options);
    const mangaId = info[0];
    const mangaTitle = info.length > 1 ? info[1] : 'Unknown';
    const res = await updateMangaList(mangaId, 'POST', pool);
    if (res.result === 'ok') { 
      await interaction.deferReply();
      await interaction.editReply({
        content: `Successfully added ${mangaTitle} <:dababy:827023206631866428>`
      });
    }
    else {
      console.log('THE ERROR', res);
      await interaction.reply({
        content: `Error!`
      });
    }
	}
  if (interaction.commandName === 'delete') {
    const info = getTitleInfo(interaction.options);
    const mangaId = info[0];
    const mangaTitle = info.length > 1 ? info[1] : 'Unknown';
    const res = await updateMangaList(mangaId, 'DELETE', pool);
    if (res.result === 'ok') {
      await interaction.deferReply();
      await interaction.editReply({
        content: `Successfully deleted ${mangaTitle}  <:dababy:827023206631866428>`
      });
    }
    else {
      console.log('THE ERROR', res);
      await interaction.reply({
        content: `Error!`
      });
    }
  }*/
});






const addCommand = new SlashCommandBuilder()
  .setName('add')
  .setDescription('Adds manga to be tracked via URL.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga').setRequired(true);
  });

const delCommand = new SlashCommandBuilder()
  .setName('delete')
  .setDescription('Adds manga to be deleted via URL.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga').setRequired(true);
  });

