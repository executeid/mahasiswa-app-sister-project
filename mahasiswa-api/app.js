const express = require('express');
const bodyParser = require('body-parser');
const mahasiswaRoutes = require('./src/routes/mahasiswa');
const logger = require('./src/utils/logger');
const dbService = require('./src/services/dbService'); // Untuk koneksi awal
const kafkaService = require('./src/services/kafkaService'); // Untuk koneksi awal

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/mahasiswa', mahasiswaRoutes);

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Mahasiswa API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Start the server
const startServer = async () => {
  try {
    await dbService.connect();
    logger.info('Connected to Mahasiswa Database.');

    await kafkaService.connectProducer();
    logger.info('Kafka Producer connected.');

    app.listen(PORT, () => {
      logger.info(`Mahasiswa API is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Mahasiswa API:', error.message);
    process.exit(1); // Exit if essential services cannot connect
  }
};

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await kafkaService.disconnectProducer();
  await dbService.disconnect();
  process.exit(0);
});