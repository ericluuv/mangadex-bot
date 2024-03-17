function formatOptions(method, auth = '', body = '') {
  //Return options parameter for fetch(), puts token and body in if needed.
  const options = {
    method: '',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    }
  }
  if (method === 'POST') { options.method = 'POST' }
  else if (method === 'DELETE') { options.method = 'DELETE'; }
  else if (method === 'GET') { options.method = 'GET'; }
  else {
    console.log('INVALID METHOD FOR OPTIONS', method);
    return { msg: `Invalid Method: ${method}` }
  }

  if (auth !== '') { options.headers['Authorization'] = auth; }
  if (body !== '') { options.body = JSON.stringify(body); }
  return options;
}

module.exports = { formatOptions };