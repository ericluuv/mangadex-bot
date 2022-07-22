"use strict";

require('dotenv').config();
// discord API
const Discord = require('discord.js');
const { MessageEmbed, MessageButton } = require('discord.js');
const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES"] });
bot.login(process.env.DISCORD_TOKEN);

//Commands
const {createCommands, commands, jarvis} = require('./commands/command-handler.js');

// postgreSQL 
const { createTables, getGuildTable, getUsersToMention } = require('./postgres/psExport.js');

//MagnaDex Stuff
const { getListUpdates, processUpdates } = require('./manga/mgExport.js');


async function pollUpdates(previousUrls) {
  //Continuously checks for updates every 10 minutes and sends them out.
  const guildTable = await getGuildTable();
  const newSet = new Set();
  for (const row of guildTable) {
    const guildId = row.guild_id, listId = row.list_id, channelId = row.channel_id;
    const updates = await getListUpdates(listId);
    if (updates.length > 0) {
      console.log(`Num of updates: ${updates.length}`);
    }
    const allEmbeds = await processUpdates(updates);

    for (const toEmbed of allEmbeds) {
      const url = toEmbed.toSend.url;
      if (!previousUrls.has(url)) {
        console.log(`Sending: ${toEmbed?.toSend?.title}`);
        newSet.add(url);
        const mangaId = toEmbed.manga_id;
        const users = await getUsersToMention(mangaId, guildId);
        await bot.channels.cache.get(channelId)?.send({ 
          content: `Update for ${users}`, embeds: [toEmbed.toSend]
        });
      }
      else {
        console.log(`Skipping, already sent: ${url}`);
      }
    }
  }
  setTimeout(function () { pollUpdates(newSet) }, 600000);
}


bot.on('ready', async () => {
  await Promise.all([createCommands(), createTables()]);

  console.log("Mangadex-bot logged in");
  bot.user.setActivity('Doki Doki Literature Club', { type: 'PLAYING' });

  pollUpdates(new Set);
});


bot.on('messageCreate', async (msg) => {
  const text = msg.content.toLowerCase().trim()
  const re = /jarvis,?\s+follow\s+.+/;
  if (text.search(re) >= 0) {
    await jarvis(msg, text);
  }
});



bot.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  await commands[interaction.commandName](interaction);
});

