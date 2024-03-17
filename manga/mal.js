const { formatOptions } = require('../options.js');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function getMalData(username) {
  //Grabes mal_ids and titles of mangas from a MAL username.
  const url = `${process.env.MAL_URL}/users/${username}/mangalist?status=reading`;
  let options = formatOptions('GET');
  options.headers['X-MAL-CLIENT-ID'] = process.env.MAL_CLIENT_ID;

  const res = await fetch(url, options);
  const json = await res.json();
  return json?.data?.map(elem => [elem?.node?.title, elem?.node?.id?.toString()]) || [];
}


async function getMalTitle(malId) {
  //Grabs malTitle from the malId
  const url = `${process.env.MAL_URL}/manga/${malId}`;
  let options = formatOptions('GET');
  options.headers['X-MAL-CLIENT-ID'] = process.env.MAL_CLIENT_ID;

  const res = await fetch(url, options);
  const json = await res.json();
  return json?.title || '';
}




module.exports = { getMalData, getMalTitle };
