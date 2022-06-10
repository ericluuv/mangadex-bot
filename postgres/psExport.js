const { pool } = require('./psPool.js');
const { checkLimit } = require('./limits.js');
const { getSessionToken } = require('./dex_tokens.js');
const { insertGuildRow, updateChannelId, getGuildTable, getGuildRow } = require('./guilds.js');
const { insertFollow, delFollow, getMangaCount, getFollowedMangas, getUsersToMention } = require('./follows.js');
const { getMangaDataRow, updateMangaTitle, updateAuthorName } = require('./manga_data.js');

//Session & Refresh token table
const makeTokensTable = 'CREATE TABLE IF NOT EXISTS dex_tokens ( \
  da_key BIGINT PRIMARY KEY,  \
  session_token TEXT,         \
  refresh_token TEXT,         \
  session_date BIGINT,        \
  refresh_date BIGINT         \
  )';

//Guilds Table
const makeGuildsTable = 'CREATE TABLE IF NOT EXISTS guilds ( \
  guild_id TEXT,          \
  list_id TEXT,           \
  channel_id TEXT,        \
  PRIMARY KEY (guild_id)  \
  )';

//Following Table
const makeFollowsTable = 'CREATE TABLE IF NOT EXISTS follows ( \
  user_id TEXT,                    \
  manga_id TEXT,                   \
  guild_id TEXT,                   \
  PRIMARY KEY (user_id, manga_id, guild_id), \
  FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE \
  )';

const makeLimitTable = 'CREATE TABLE IF NOT EXISTS limits ( \
  row_key BIGINT PRIMARY KEY, \
  usage BIGINT, \
  refresh_time BIGINT \
  )';

const makeMangaTable = 'CREATE TABLE IF NOT EXISTS manga_data ( \
  manga_id TEXT, \
  manga_title TEXT, \
  author_name TEXT, \
  PRIMARY KEY (manga_id) \
  )';


async function createTables() {
  //Makes all tables if they don't exist for postgresql.
  const promises = [
    pool.connect().then(console.log('PostgreSQL connected.')),

    pool.query(makeTokensTable)
      .then(console.log('dex_tokens table made successfully'))
      .catch(err => console.log(err)),

    pool.query(makeGuildsTable)
      .then(console.log('guilds table made successfully'))
      .catch(err => console.log(err)),

    pool.query(makeFollowsTable)
      .then(console.log('follows table made successfully'))
      .catch(err => console.log(err)),

    pool.query(makeLimitTable)
      .then(console.log('limits table made successfully'))
      .catch(err => console.log(err)),

    pool.query(makeMangaTable)
      .then(console.log('manga_data table made successfully'))
      .catch(err => console.log(err))
  ];
  await Promise.all(promises);
}


module.exports = {
  createTables,
  getSessionToken,
  insertGuildRow,
  updateChannelId,
  getGuildTable,
  getGuildRow,
  insertFollow,
  delFollow,
  getMangaCount,
  getFollowedMangas,
  getUsersToMention,
  checkLimit, 
  getMangaDataRow,
  updateMangaTitle,
  updateAuthorName
};
