const { pool } = require('./psPool.js');


function insertMangaData(mangaId, mangaTitle, authorName) {
  //Inserts new values into manga_data.
  const insertString = `INSERT INTO manga_data VALUES ('${mangaId}',
    '${mangaTitle}', '${authorName}');`;

  return pool.query(insertString).then(res => {
    if (res?.rowCount === 1) {
      console.log('Inserted values into manga_data', mangaId, mangaTitle, authorName);
    }
    else { console.log(`No insertion of '${mangaId}', '${mangaTitle}', '${authorName}'`); }
  }).catch(err => console.log(err));
}


function getMangaDataRow(mangaId) {
  //Selects row where MangaId matches.
  const selectString = `SELECT * FROM manga_data WHERE manga_id = '${mangaId}';`;

  return pool.query(selectString).then(res => {
    return res?.rows?.[0];
  }).catch(err => console.log(err));
}


async function updateMangaTitle(mangaId, mangaTitle) {
  //Updates row if exists, otherwise inserts it.
  const res = await getMangaDataRow(mangaId);
  mangaTitle = mangaTitle.replaceAll("'", "''");
  if (res) {
    const updateString = `UPDATE manga_data SET manga_title = '${mangaTitle}' WHERE manga_id = '${mangaId}';`;
    await pool.query(updateString).then(res => {
      console.log(`Updated manga_title = ${mangaTitle} for ${mangaId}`);
    }).catch(err => console.log(err));
  }
  else {
    await insertMangaData(mangaId, mangaTitle, '');
  }
}


async function updateAuthorName(mangaId, authorName) {
  //Updates row if exists, otherwise inserts it.
  const res = await getMangaDataRow(mangaId);
  if (res) {
    const updateString = `UPDATE manga_data SET author_name = '${authorName}' WHERE manga_id = '${mangaId}';`;
    await pool.query(updateString).then(res => {
      console.log(`Updated author_name = ${authorName} for ${mangaId}`);
    }).catch(err => console.log(err));
  }
  else { 
    await insertMangaData(mangaId, '', authorName);
  }
}


module.exports = {
  insertMangaData, getMangaDataRow, updateMangaTitle, updateAuthorName
};