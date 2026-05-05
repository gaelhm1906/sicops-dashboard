const { Pool } = require('pg');

if (!process.env.DB_HOST) {
  console.error("❌ DB_HOST no definido");
  process.exit(1);
}

const sslConfig = process.env.DB_SSL === 'false'
  ? false
  : { rejectUnauthorized: false };

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      sslConfig
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en pool PostgreSQL:', err.message);
});

module.exports = pool;
