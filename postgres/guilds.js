const { pool } = require('./psPool.js');


function insertGuildRow(guildId, listId, channelId) {
  //Inserts a new row into guilds table.
  const insertString = `INSERT INTO guilds VALUES('${guildId}', '${listId}', '${channelId}');`;
  return pool.query(insertString).then(res => {
    if (res?.rowCount === 1) {
      console.log(`Insertion of ${guildId}, ${listId}, ${channelId} successful`);
    }
    else { console.log(`No insertion of ${guildId}', '${listId}', '${channelId}`); }
  }).catch(err => console.log(err));
}


function updateChannelId(guildId, channelId) {
  //Updates channelId based on guildId and channelId.
  const updateString = `UPDATE guilds SET channel_id = '${channelId}' WHERE guild_id = '${guildId}';`;
  return pool.query(updateString).then(res => {
    if (res?.rowCount === 1) {
      console.log(`Update of ${guildId}, ${channelId} successful`);
    }
    else { console.log(`No update of ${guildId}', '${channelId}`); }
  }).catch(err => console.log(err));
}


function getGuildTable() {
  //Returns the guilds table with all its rows.
  const selectString = `SELECT * FROM guilds;`;
  return pool.query(selectString).then(res => res?.rows)
    .catch(err => {
      console.log(err);
      return [];
    });
}


function getGuildRow(guildId) {
  //Returns row with corresponding guildId.
  const selectString = `SELECT * FROM guilds WHERE guild_id = '${guildId}';`;
  return pool.query(selectString).then(res => res.rows)
    .catch(err => {
      console.log(err);
      return [];
    });
}


module.exports = {
  insertGuildRow, updateChannelId, getGuildTable, getGuildRow
};