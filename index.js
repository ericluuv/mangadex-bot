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
const { createTables, getGuildTable, updateChannelId, insertGuildRow } = require('./postgres.js');

//MagnaDex Stuff
const { getMangaUpdates, processUpdates, createList } = require('./manga.js');


async function pollUpdates(previousUrls) {
  //Continuously checks for updates every 10 minutes and sends them out.
  for (const row of (await getGuildTable())) {
    const listId = row.list_id, channelId = row.channel_id;
    const updates = await getMangaUpdates(listId);
    console.log(`Num of updates: ${updates.length}`);
    const newSet = new Set();
    for (const toEmbed of (await processUpdates(updates))) {
      if (!previousUrls.has(toEmbed.embeds[0].url)) {
        newSet.add(toEmbed.embeds[0].url);
        await bot.channels.cache.get(channelId).send(toEmbed);
      }
    }
    setTimeout(function(){pollUpdates(newSet)}, 600000);
  }
}


bot.on('ready', async () => {
  await createCommands();
  await createTables();

  console.log("Mangadex-bot logged in");
  bot.user.setActivity('Doki Doki Literature Club', { type: 'PLAYING' });

  pollUpdates(new Set());
});


bot.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'add' || interaction.commandName === 'delete') {
    await handleFollowCommand(interaction);
  }

  else if (interaction.commandName === 'set') {
    //Had to handle command here to avoid circular dependency.
    await interaction.deferReply();
    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;
    const guilds = (await getGuildTable()).map((elem) => {
      return elem.guild_id;
    });
    console.log(guildId, channelId, guilds);
    if (guilds.includes(guildId)) {
      await updateChannelId(guildId, channelId);
    }
    else {
      const listId = await createList('botList' + 1);
      if (typeof(listId) != 'undefined') { insertGuildRow(guildId, listId, channelId); }
    }
    await interaction.editReply({content: 'Channel Successfuly Set'});
  }

  else if (interaction.commandName === 'list') {

  }

});

