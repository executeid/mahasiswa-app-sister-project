const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  user: process.env.DB_USER || 'log_user',
  host: process.env.DB_HOST || 'postgres-log-service', // Nama service Kubernetes DB Log
  database: process.env.DB_NAME || 'log_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client (Log DB)', err);
  process.exit(1);
});

exports.connect = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('PostgreSQL Log DB connected successfully.');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS event_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        timestamp_api_sent BIGINT,
        timestamp_consumer_received BIGINT,
        timestamp_db_saved TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        trace_id VARCHAR(50),
        api_processing_latency_ns VARCHAR(255) -- Store as string for BigInt
      );
    `;
    await pool.query(createTableQuery);
    logger.info('Event_logs table checked/created.');
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL Log DB or create table:', err.message);
    throw err;
  }
};

exports.insertLog = async (logEntry) => {
  const query = `
    INSERT INTO event_logs(event_type, event_data, timestamp_api_sent, timestamp_consumer_received, trace_id, api_processing_latency_ns)
    VALUES($1, $2, $3, $4, $5, $6) RETURNING *;
  `;
  const values = [
    logEntry.event_type,
    logEntry.event_data,
    logEntry.timestamp_api_sent,
    logEntry.timestamp_consumer_received,
    logEntry.trace_id,
    logEntry.api_processing_latency_ns
  ];
  return pool.query(query, values);
};

exports.disconnect = async () => {
  await pool.end();
  logger.info('PostgreSQL Log DB pool has ended.');
};