const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'academic-service-producer',
  brokers: [process.env.KAFKA_BROKER || 'kafka-service:9092'],
});

const producer = kafka.producer();
let isProducerConnected = false;

exports.connectProducer = async () => {
  try {
    await producer.connect();
    isProducerConnected = true;
    logger.info('Kafka Producer connected for Academic Service.');
  } catch (error) {
    logger.error('Failed to connect Kafka Producer for Academic Service:', error.message);
    isProducerConnected = false;
    throw error;
  }
};

exports.publishEvent = async (topic, payload) => {
  if (!isProducerConnected) {
    logger.warn('Kafka Producer for Academic Service is not connected. Attempting to reconnect...');
    await exports.connectProducer();
    if (!isProducerConnected) {
      logger.error('Kafka Producer for Academic Service still not connected. Cannot publish event.');
      throw new Error('Kafka Producer for Academic Service not connected');
    }
  }
  try {
    await producer.send({
      topic: topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    logger.info(`Message published to topic ${topic} from Academic Service`);
  } catch (error) {
      logger.error(`Error publishing message to Kafka topic ${topic} from Academic Service: ${error.message}`, error.stack);
      throw error;
  }
};

exports.disconnectProducer = async () => {
  if (isProducerConnected) {
    await producer.disconnect();
    isProducerConnected = false;
    logger.info('Kafka Producer for Academic Service disconnected.');
  }
};