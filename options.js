const headers = {
  'Accept': 'application/json',
  'Content-type': 'application/json',
};
const pOptions = { method: 'POST', headers };
const dOptions = { method: 'DELETE', headers };
const gOptions = { method: 'GET', headers };

function formatOptions(method, auth = '', body = '') {
  //Return options parameter for fetch(), puts token in if needed.
  let options;
  if (method === 'POST') { options = pOptions; }
  else if (method === 'DELETE') { options = dOptions; }
  else if (method === 'GET') { options = gOptions; }
  else {
    console.log('INVALID METHOD FOR OPTIONS', method);
    return { msg: `Invalid Method: ${method}` }
  }

  if (auth !== '') { options.headers['Authorization'] = auth; }
  if (body !== '') { options.body = JSON.stringify(body); }
  return options;
}

module.exports = { formatOptions };