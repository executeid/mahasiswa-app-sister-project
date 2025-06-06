const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  user: process.env.DB_USER || 'mahasiswa_user',
  host: process.env.DB_HOST || 'postgres-mahasiswa-service', // Nama service Kubernetes DB
  database: process.env.DB_NAME || 'mahasiswa_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long the pool will try to connect before erroring
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(1); // Exit if database connection becomes critical
});

exports.connect = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('PostgreSQL Mahasiswa DB connected successfully.');
    // Inisialisasi skema tabel jika belum ada
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS mahasiswa (
        id UUID PRIMARY KEY,
        nim VARCHAR(20) UNIQUE NOT NULL,
        nama VARCHAR(100) NOT NULL,
        jurusan VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    logger.info('Mahasiswa table checked/created.');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL Mahasiswa DB or create table:', err.message);
    throw err;
  }
};

exports.query = (text, params) => pool.query(text, params);

exports.disconnect = async () => {
  await pool.end();
  logger.info('PostgreSQL Mahasiswa DB pool has ended.');
};