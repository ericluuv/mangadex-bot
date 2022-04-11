"use strict";

require('dotenv').config();
// discord API
const Discord = require('discord.js');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES"] });
bot.login(process.env.DISCORD_STAGING_TOKEN);

// request API
const fetch = require('node-fetch');

//Commands
const { createCommands, handleFollowCommand } = require('./commands.js')

// postgreSQL 
const { createTables } = require('./postgres.js');

//MagnaDex Stuff
const { getMangaUpdates, processUpdates } = require('./manga.js');

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
  setTimeout(function(){pollUpdates(newSet, channel)}, 600000);
}


bot.on('ready', async () => {
  await createCommands();
  await createTables();

  console.log("Mangadex-bot logged in");
  bot.user.setActivity('Doki Doki Literature Club', { type: 'PLAYING' });

  const channel = bot.channels.cache.get(process.env.CHANNEL_STAGING_ID);
  pollUpdates(new Set(), channel);
});


//Eric functions
bot.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'add' || interaction.commandName === 'delete') {
    await handleFollowCommand(interaction);
  }
});

