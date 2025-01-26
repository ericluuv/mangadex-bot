const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

const dbUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}` +
              `@mangabot_db:${process.env.PGPORT}/${process.env.PGDATABASE}`;

const pool = new Pool({ connectionString: dbUrl });

module.exports = {
  pool: pool
};
