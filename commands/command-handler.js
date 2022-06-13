const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const global_url = `https://discord.com/api/v10/applications/${process.env.APPLICATION_ID}/commands`;
const fetch = require('node-fetch');
const { formatOptions } = require('../options.js');
const { followCommand, handleFollowCommand } = require('./follow.js');
const { listMangaCommand, handleListCommand } = require('./list.js');
const { migrateCommand, handleMigrateCommand } = require('./migrate.js');
const { setChannelCommand, handleSetCommand } = require('./set.js');
const { unfollowCommand, handleUnfollowCommand } = require('./unfollow.js');
const commandArr = [followCommand, unfollowCommand, setChannelCommand, listMangaCommand, migrateCommand];
const commands = {  
  'follow': handleFollowCommand,
  'unfollow': handleUnfollowCommand,
  'list': handleListCommand,
  'migrate': handleMigrateCommand,
  'set': handleSetCommand
};


async function getCurrentCommands() {
  //Gets names of all global commands.
  const options = formatOptions('GET', `Bot ${process.env.DISCORD_TOKEN}`);

  const res = await fetch(global_url, options).catch(err => console.log(err));
  const json = await res.json();
  return json.map(command => command.name);
}


async function createCommands() {
  //Creates commands if they are not already made.
  const currents = await getCurrentCommands();
  for (const command of commandArr) {
    if (currents.includes(command.name)) { continue; }
    const options = formatOptions('POST', `Bot ${process.env.DISCORD_TOKEN}`, command.toJSON());
    const response = await fetch(global_url, options);
    console.log(await response.json());
  }
  console.log('Commands created');
}

module.exports = { createCommands, commands };
