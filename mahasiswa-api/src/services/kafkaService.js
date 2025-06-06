const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'mahasiswa-api-producer',
  brokers: [process.env.KAFKA_BROKER || 'kafka-service:9092'], // Nama service Kubernetes Kafka
});

const producer = kafka.producer();
let isProducerConnected = false;

exports.connectProducer = async () => {
  try {
    await producer.connect();
    isProducerConnected = true;
    logger.info('Kafka Producer connected successfully.');
  } catch (error) {
    logger.error('Failed to connect Kafka Producer:', error.message);
    isProducerConnected = false;
    throw error;
  }
};

exports.publishEvent = async (topic, payload) => {
  if (!isProducerConnected) {
    logger.warn('Kafka Producer is not connected. Attempting to reconnect...');
    await exports.connectProducer(); // Try to reconnect
    if (!isProducerConnected) {
      logger.error('Kafka Producer still not connected. Cannot publish event.');
      throw new Error('Kafka Producer not connected');
    }
  }
  try {
    await producer.send({
      topic: topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    logger.info(`Message published to topic ${topic}`);
  } catch (error) {
    logger.error(`Error publishing message to Kafka topic ${topic}: ${error.message}`, error.stack);
    throw error;
  }
};

exports.disconnectProducer = async () => {
  if (isProducerConnected) {
    await producer.disconnect();
    isProducerConnected = false;
    logger.info('Kafka Producer disconnected.');
  }
};