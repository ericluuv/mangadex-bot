"use strict";

require('dotenv').config();
// discord API
const Discord = require('discord.js');
const { MessageEmbed, MessageButton } = require('discord.js');
const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES"] });
bot.login(process.env.DISCORD_TOKEN);

//Commands
const {
  createCommands, handleFollowCommand, handleUnfollowCommand,
  handleSetCommand, handleListCommand, handleMigrateCommand
} = require('./commands.js');

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
    console.log('Num of updates:', updates.length);
    const allEmbeds = await processUpdates(updates);

    for (const toEmbed of allEmbeds) {
      const url = toEmbed.toSend.url;
      if (!previousUrls.has(url)) {
        newSet.add(url);
        const mangaId = toEmbed.manga_id;
        const users = await getUsersToMention(mangaId, guildId);
        await bot.channels.cache.get(channelId).send({ 
          content: `Update for ${users}`, embeds: [toEmbed.toSend]
        });
      }
    }
  }
  setTimeout(function () { pollUpdates(newSet) }, 600000);
}


bot.on('ready', async () => {
  await Promise.all([createCommands(), createTables()]);

  console.log("Mangadex-bot logged in");
  bot.user.setActivity('Doki Doki Literature Club', { type: 'PLAYING' });

  pollUpdates(new Set());
});


bot.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'follow') {
    await handleFollowCommand(interaction);
  }

  else if (interaction.commandName === 'unfollow') {
    await handleUnfollowCommand(interaction);
  }

  else if (interaction.commandName === 'set') {
    await handleSetCommand(interaction);
  }

  else if (interaction.commandName === 'list') {
    await handleListCommand(interaction);
  }

  else if (interaction.commandName === 'migrate') {
    await handleMigrateCommand(interaction);
  }
});

