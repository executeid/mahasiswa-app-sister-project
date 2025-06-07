const { Kafka } = require('kafkajs');
const logger = require('./src/utils/logger');
const dbLogService = require('./src/services/dbLogService');
const kafkaConsumerService = require('./src/services/kafkaConsumerService');
const kafkaAcademicConsumerService = require('./src/services/kafkaAcademicConsumerService'); // BARU

const startConsumer = async () => {
  try {
    await dbLogService.connect();
    logger.info('Connected to Log/Analytics Database.');

    await kafkaConsumerService.startConsuming('mahasiswa_events', 'mahasiswa-event-group', async ({ topic, partition, message }) => {
        // Log for debugging (bisa dihapus nanti)
        console.log(`[DEBUG_CONSUMER_MAHASISWA_RAW] Received RAW message from <span class="math-inline">\{topic\}\:</span>{partition}. Offset: ${message.offset}`); 
        try {
            const payload = JSON.parse(message.value.toString());
            console.log(`[DEBUG_CONSUMER_MAHASISWA_PARSED] Payload parsed: ${JSON.stringify(payload)}`); 
            logger.info(`Received message from <span class="math-inline">\{topic\}\:</span>{partition}: ${JSON.stringify(payload)}`);

            // Log event to Log/Analytics DB
            await dbLogService.insertLog({
                event_type: payload.type,
                event_data: payload.data,
                timestamp_api_sent: payload.timestamp_api_sent,
                timestamp_consumer_received: Date.now(),
                trace_id: payload.trace_id,
                api_processing_latency_ns: payload.api_processing_latency_ns
            });
            logger.info(`Event logged to DB for trace_id: ${payload.trace_id}`);

        } catch (error) {
            console.error(`[DEBUG_CONSUMER_MAHASISWA_ERROR] Error in eachMessage handler: ${error.message}`, error.stack);
            logger.error(`Error processing message from Kafka: ${error.message}`, error.stack);
        }
    });

    // Start consuming academic events
    await kafkaAcademicConsumerService.startConsuming(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', 'academic-event-group', async ({ topic, partition, message }) => {
        try {
            const payload = JSON.parse(message.value.toString());
            logger.info(`Received Academic event from ${topic}:${partition}: ${JSON.stringify(payload)}`);

            // Simpan semua event akademik ke Log DB
            await dbLogService.insertLog({
                event_type: payload.type,
                event_data: payload.data,
                timestamp_api_sent: payload.timestamp, // Gunakan timestamp event dari Academic Service
                timestamp_consumer_received: Date.now(),
                trace_id: payload.trace_id,
                // Tidak ada api_processing_latency_ns dari Academic event saat ini, bisa ditambahkan jika perlu
            });
            logger.info(`Academic event logged to DB for trace_id: ${payload.trace_id}`);
        } catch (error) {
            logger.error(`Error processing Academic event in Consumer Service: ${error.message}`, error.stack);
        }
    });

    logger.info('Kafka Consumer started.');

  } catch (error) {
    logger.error('Failed to start Consumer Service:', error.message);
    process.exit(1);
  }
};

startConsumer();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing consumer');
  await kafkaConsumerService.stopConsuming(); // Stop Mahasiswa consumer
  await kafkaAcademicConsumerService.stopConsuming(); // Stop Academic consumer BARU
  await dbLogService.disconnect();
  process.exit(0);
});