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


bot.on('ready', async () => {
  console.log("Mangadex-bot logged in");

  let commands;
  const guild = bot.guilds.cache.get(process.env.GUILD_ID);
  if (guild) { commands = guild.commands; }
  else { commands = bot.application?.commands; }

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

