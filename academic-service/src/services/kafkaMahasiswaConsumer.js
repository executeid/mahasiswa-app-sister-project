const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');
const dbService = require('./dbService'); // Menggunakan dbService dari Academic Service

const kafka = new Kafka({
  clientId: 'academic-service-mahasiswa-consumer',
  brokers: [process.env.KAFKA_BROKER || 'kafka-service:9092'],
});

const consumer = kafka.consumer({ groupId: 'academic-service-mahasiswa-group' }); // Group ID unik
let isConsumerConnected = false;

exports.startConsuming = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'mahasiswa_events', fromBeginning: false }); // Dari sekarang

    consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          logger.info(`Academic Service received Mahasiswa event from ${topic}:${partition}: ${JSON.stringify(payload)}`);

          const { type, data } = payload;
          if (type === 'MAHASISWA_ADDED') {
            await dbService.query(
              'INSERT INTO students_local_copy(student_id, nim, name, major) VALUES($1, $2, $3, $4) ON CONFLICT (nim) DO UPDATE SET name = EXCLUDED.name, major = EXCLUDED.major, updated_at = CURRENT_TIMESTAMP',
              [data.id, data.nim, data.nama, data.jurusan]
            );
            logger.info(`Mahasiswa ${data.nim} added/updated in local copy (Academic DB).`);
          } else if (type === 'MAHASISWA_UPDATED') {
            await dbService.query(
              'UPDATE students_local_copy SET name = $1, major = $2, updated_at = CURRENT_TIMESTAMP WHERE student_id = $3',
              [data.nama, data.jurusan, data.id]
            );
            logger.info(`Mahasiswa ${data.nim} updated in local copy (Academic DB).`);
          }
          // Tambahkan logika untuk DELETE jika ada event DELETE_MAHASISWA
        } catch (error) {
          logger.error(`Error processing Mahasiswa event in Academic Service: ${error.message}`, error.stack);
        }
      },
    });
    isConsumerConnected = true;
    logger.info('Academic Service Kafka Mahasiswa Consumer started.');
  } catch (error) {
    logger.error('Failed to start Academic Service Kafka Mahasiswa Consumer:', error.message);
    isConsumerConnected = false;
    throw error;
  }
};

exports.stopConsuming = async () => {
  if (isConsumerConnected) {
    await consumer.disconnect();
    isConsumerConnected = false;
    logger.info('Academic Service Kafka Mahasiswa Consumer disconnected.');
  }
};