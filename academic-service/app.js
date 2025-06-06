const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./src/utils/logger');
const dbService = require('./src/services/dbService');
const kafkaService = require('./src/services/kafkaService');
const kafkaMahasiswaConsumer = require('./src/services/kafkaMahasiswaConsumer');

// Import Routes
const authRoutes = require('./src/routes/auth');
const lecturerRoutes = require('./src/routes/lecturers');
const courseRoutes = require('./src/routes/courses');
const classRoutes = require('./src/routes/classes');
const classCourseRoutes = require('./src/routes/classCourses');
const attendanceSessionRoutes = require('./src/routes/attendanceSessions');
const attendanceRoutes = require('./src/routes/attendances');
const reportRoutes = require('./src/routes/reports');

const app = express();
const PORT = process.env.PORT || 3001; // Port untuk Academic Service

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/auth', authRoutes);
app.use('/lecturers', lecturerRoutes);
app.use('/courses', courseRoutes);
app.use('/classes', classRoutes);
app.use('/class-courses', classCourseRoutes);
app.use('/attendance-sessions', attendanceSessionRoutes);
app.use('/attendances', attendanceRoutes);
app.use('/reports', reportRoutes);

// Basic Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Academic API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error in Academic API: ${err.message}`, err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Start the server and essential services
const startServer = async () => {
  try {
    await dbService.connect();
    logger.info('Connected to Academic Database.');

    await kafkaService.connectProducer();
    logger.info('Kafka Producer connected for Academic Service.');

    // Start consuming mahasiswa events for local copy
    await kafkaMahasiswaConsumer.startConsuming();
    logger.info('Kafka Mahasiswa Consumer started for Academic Service.');

    app.listen(PORT, () => {
      logger.info(`Academic API is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Academic API:', error.message);
    process.exit(1);
  }
};

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing Academic API HTTP server');
  await kafkaService.disconnectProducer();
  await dbService.disconnect();
  await kafkaMahasiswaConsumer.stopConsuming();
  process.exit(0);
});