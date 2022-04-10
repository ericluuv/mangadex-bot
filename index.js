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
  /*
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }*/
  connectionString: process.env.DATABASE_URL
});
pool.connect().then(console.log('PostgreSQL connected.'));

//Session & Refresh token table
const makeTokensTable = 'CREATE TABLE IF NOT EXISTS dex_tokens ( \
  da_key BIGINT PRIMARY KEY,  \
  session_token TEXT,         \
  refresh_token TEXT,         \
  session_date BIGINT,        \
  refresh_date BIGINT         \
  )';

pool.query(makeTokensTable, (err, res) => {
  if (err) { console.log(err); }
  else { console.log('dex_tokens table made successfully'); }
});

//Following Table
const makeFollowsTable = 'CREATE TABLE IF NOT EXISTS follows ( \
  user_id TEXT,                   \
  manga_id TEXT,                  \
  PRIMARY KEY (user_id, manga_id) \
  )';
pool.query(makeFollowsTable, (err, res) => {
  if (err) { console.log(err); }
  else { console.log('follows table made successfully'); }
});
  

//MagnaDex Stuff
const { getTitleInfo, updateMangaList, getMangaUpdates, processUpdates } = require('./manga.js');

async function pollUpdates(previousUrls, channel) {
  //Continuously checks for updates every 10 minutes and sends them out.
  const updates = await getMangaUpdates();
  console.log(`Num of updates: ${updates.length}`);
  const newSet = new Set();
  for (const toEmbed of (await processUpdates(updates))) {
    if (!previousUrls.has(toEmbed.embeds[0].url)) {
      newSet.add(toEmbed.embeds[0].url);
      await channel.send(toEmbed);
    }
  }
  setTimeout(function(){pollUpdates(newSet, channel)}, 30000);
}


bot.on('ready', async () => {
  const commands = bot.guilds.cache.get(process.env.GUILD_ID).commands;
  await commands.create(addCommand);
  await commands.create(delCommand);
  console.log('Commands created');

  console.log("Mangadex-bot logged in");
  bot.user.setActivity('Doki Doki Literature Club', { type: 'PLAYING' });

  const channel = bot.channels.cache.get(process.env.CHANNEL_ID);
  pollUpdates(new Set(), channel);
});


//Eric functions
bot.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'add' || interaction.commandName === 'delete') {
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
    const res = await updateMangaList(mangaId, method, pool);
    if (res.result === 'ok') {
      await interaction.deferReply();
      await interaction.editReply({
        content: `Successfully ${verb} ${mangaTitle} <:dababy:827023206631866428>`
      });
    }
    else {
      console.log(`Failed: ${res}`);
      await interaction.reply({
        content: `Error!`
      });
    }
  }
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
  .setDescription('Removes manga from the tracking list via URL.')
  .addStringOption((option) => {
    return option.setName('url')
      .setDescription('The URL of the manga').setRequired(true);
  });
