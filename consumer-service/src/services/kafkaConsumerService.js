const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

// Use Pod IP or NodePort for brokers, not 'kafka-service' if running outside cluster
const KAFKA_BROKERS = [process.env.KAFKA_BROKER || '10.244.1.105:9092'];

const kafka = new Kafka({
  clientId: 'consumer-service',
  brokers: KAFKA_BROKERS,
});

let consumer = null;

exports.startConsuming = async (topic, groupId, messageHandler) => {
  consumer = kafka.consumer({ groupId: groupId });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: topic, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await messageHandler({ topic, partition, message });
      },
    });
    logger.info(`Kafka Consumer subscribed to topic ${topic} with group ${groupId}`);
  } catch (error) {
    logger.error('Failed to start Kafka Consumer:', error.message);
    throw error;
  }
};

exports.stopConsuming = async () => {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka Consumer disconnected.');
  }
};