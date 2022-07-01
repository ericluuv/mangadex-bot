const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getRandomManga } = require('../manga/mgExport.js');


const randomMangaCommand = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Returns a random manga from Mangadex')
  ;


async function handleRandomCommand(interaction) {
  await interaction.deferReply();
  const embed = await getRandomManga();
  await interaction.editReply({embeds: [embed]});
}


module.exports = { randomMangaCommand, handleRandomCommand };