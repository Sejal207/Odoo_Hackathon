const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  // Add additional config like max, idleTimeoutMillis if needed for prod
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
