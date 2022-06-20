const { SlashCommandBuilder } = require('@discordjs/builders');
const { getGuildTable, updateChannelId, insertGuildRow } = require('../postgres/psExport.js');
const { createList } = require('../manga/mgExport.js');

const setChannelCommand = new SlashCommandBuilder()
  .setName('set')
  .setDescription('Sets the current channel as the location for manga updates.')
  ;


async function handleSetCommand(interaction) {
  await interaction.deferReply();
  const guildId = interaction.guild.id;
  const channelId = interaction.channel.id;
  const guilds = (await getGuildTable()).map(row => row.guild_id);

  if (guilds.includes(guildId)) {
    await updateChannelId(guildId, channelId);
  }
  else {
    const listId = await createList('botList' + (guilds.length + 1));
    if (typeof (listId) != 'undefined') { insertGuildRow(guildId, listId, channelId); }
  }
  await interaction.editReply({ content: 'Channel Successfuly Set' });
}

module.exports = { setChannelCommand, handleSetCommand };