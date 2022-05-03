const { pool } = require('./psPool.js');

async function checkLimit() {
  //Checks amount of times mangaDex API has been hit in the last 1.2 seconds
  //awaits if over limit.
  const selectString = 'SELECT * FROM limits WHERE row_key = 0;';
  const rows = (await pool.query(selectString).catch(err => console.log(err))).rows;
  const now = Date.now();
  const refresh = now - rows?.[0]?.refresh_time >= 1200;

  if (rows.length == 0) { //Insert new row
    const insertString = `INSERT INTO limits VALUES (0, 0, ${now});`;
    await pool.query(insertString).catch(err => console.log(err));
  }
  else if (rows[0].usage >= 5 || refresh) { //Update then await 1.2 seconds
    const updateString = `UPDATE limits SET usage = 0, refresh_time = ${now} WHERE row_key = 0;`;
    await pool.query(updateString).catch(err => console.log(err));
    if (!refresh) {
      console.log('Hit limit, timing out for 1.2 seconds');
      const wait = await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }
  else { //Increment usage
    const incrementString = `UPDATE limits SET usage = ${parseInt(rows[0].usage) + 1} WHERE row_key = 0;`;
    await pool.query(incrementString).catch(err => console.log(err));
  }
}

module.exports = { checkLimit }; 