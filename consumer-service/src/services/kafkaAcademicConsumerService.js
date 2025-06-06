const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'consumer-service-academic-consumer',
  brokers: [process.env.KAFKA_BROKER || 'kafka-service:9092'],
});

let consumer = null;

exports.startConsuming = async (topic, groupId, messageHandler) => {
  consumer = kafka.consumer({ groupId: groupId });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: topic, fromBeginning: false }); // Dari sekarang

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await messageHandler({ topic, partition, message });
      },
    });
    logger.info(`Kafka Academic Consumer subscribed to topic ${topic} with group ${groupId}`);
  } catch (error) {
    logger.error('Failed to start Kafka Academic Consumer:', error.message);
    throw error;
  }
};

exports.stopConsuming = async () => {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka Academic Consumer disconnected.');
  }
};