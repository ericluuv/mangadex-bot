const { SlashCommandBuilder } = require('@discordjs/builders');
const { checkGuild } = require('./helper.js');
const { getFollowedMangas } = require('../postgres/psExport.js');
const { getFieldsFromMangaIds } = require('../manga/mgExport.js');
const { MessageButton, MessageEmbed } = require('discord.js');
const paginationEmbed = require('discordjs-button-pagination');


const listMangaCommand = new SlashCommandBuilder()
  .setName('list')
  .setDescription('Lists manga the user is currently folllowing')
  ;


async function handleListCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const guildStatus = await checkGuild(interaction);
  if (!guildStatus) { return; }

  const mangaIds = await getFollowedMangas(guildId, userId);
  await interaction.editReply({ content: `Processing ${mangaIds.length} mangas...` });
  const fields = await getFieldsFromMangaIds(mangaIds);
  const groupedFields = [];
  for (let i = 0; i < fields.length; i += 10) {
    groupedFields.push(fields.slice(i, i + 10));
  }

  const button1 = new MessageButton()
    .setCustomId("previousbtn")
    .setStyle("SECONDARY")
    .setEmoji('⏮️');
  const button2 = new MessageButton()
    .setCustomId("nextbtn")
    .setStyle("SECONDARY")
    .setEmoji('⏭️');

  let counter = 0;
  const embeds = groupedFields.map(groupedField => {
    counter += groupedField.length;
    return new MessageEmbed()
      .setTitle(`${interaction.user.username}'s List`)
      .setDescription(`${counter} / ${fields.length}`)
      .setFields(groupedField);
  });
  
  await interaction.editReply({ content: 'Done!' });
  if (embeds.length === 0) {
    await interaction.channel.send({ content: 'Following 0 Mangas' });
  }
  else {
    await paginationEmbed(interaction, embeds, [button1, button2], 60000);
  }
}

module.exports = { listMangaCommand, handleListCommand };

