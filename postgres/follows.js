const { pool } = require('./psPool.js')


function insertFollow(userId, mangaId, guildId) {
  //Returns true if a new follow was added, false if not.
  const checkString = `SELECT * FROM follows WHERE user_id = '${userId}' AND 
    manga_id = '${mangaId}' AND guild_id = '${guildId}';`;
  const insertString = `INSERT INTO follows VALUES ('${userId}', '${mangaId}', '${guildId}');`;

  return pool.query(checkString)
    .then(res => {
      const len = res?.rowCount || 0;
      if (len === 0) {
        return pool.query(insertString).then(res => res?.rowCount);
      }
    })
    .catch(err => console.log(err));
}


function delFollow(userId, mangaId, guildId) {
  //Deletes the specified row from the follows table;
  const deleteString = `DELETE FROM follows WHERE user_id = '${userId}' AND
    manga_id = '${mangaId}' AND guild_id = '${guildId}';`;
  return pool.query(deleteString).then(res => res?.rowCount)
    .catch(err => console.log(err));
}


function getMangaCount(mangaId, guildId) {
  //Grabs count of how many people are following a manga in a guild. 
  const countString = `SELECT COUNT(*) FROM follows WHERE manga_id = '${mangaId}'
  AND guild_id = '${guildId}';`;
  return pool.query(countString).then(res => res?.rows?.[0]?.count)
    .catch(err => console.log(err));
}


function getFollowedMangas(guildId, userId) {
  //Gets all mangaIds that a user is following in a guild.
  const selectString = `SELECT manga_id FROM follows WHERE guild_id = '${guildId}'
    AND user_id = '${userId}';`;

  return pool.query(selectString).then(res => res?.rows.map(row => row.manga_id))
    .catch(err => console.log(err));
}


function getUsersToMention(mangaId, guildId) {
  //Returns the userIds in a where it'll mention the users.
  const selectString = `SELECT user_id FROM follows WHERE guild_id = '${guildId}'
    AND manga_id = '${mangaId}';`;

  return pool.query(selectString).then(res => {
    return res.rows.map(row => `<@${row.user_id}>`).join(' ');
  }).catch(err => console.log(err));
}

module.exports = {
  insertFollow,
  delFollow,
  getMangaCount,
  getFollowedMangas,
  getUsersToMention,
};