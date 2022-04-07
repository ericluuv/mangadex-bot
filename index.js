"use strict";

// discord API
const Discord = require('discord.js');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES"] });
require('dotenv').config();
bot.login(process.env.DISCORD_TOKEN);

// request API
const fetch = require('node-fetch');
// postgreSQL API
const { Pool, Client } = require('pg');

//MagnaDex URL
const mangadex_url = "https://api.mangadex.org";
const listId = 'a1c6b4c7-d6cc-4a82-97a7-506825bf81c4';

const pool = new Pool({
  user: 'postgres',
  database: 'postgres',
  password: '0000',
  port: 5432,
  server: 'localhost'
});

pool.connect().then(console.log('connected to database'))


bot.on('ready', () => {
  console.log("Bot logged in");

  
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

