// tests/kafka-latency.test.js
const { Kafka } = require('kafkajs');
const { KAFKA_BROKERS } = require('./configs');

const TOPIC = 'latency_test_topic';
const GROUP_ID = 'latency-test-group';

(async () => {
  const kafka = new Kafka({
    clientId: 'latency-test-client',
    brokers: KAFKA_BROKERS,
  });

  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  let sentTimestamp = Date.now();
  let received = false;

  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      if (payload && payload.test === 'latency' && payload.sentTimestamp === sentTimestamp) {
        const latency = Date.now() - payload.sentTimestamp;
        console.log(`Kafka end-to-end latency: ${latency} ms`);
        received = true;
        await producer.disconnect();
        await consumer.disconnect();
        process.exit(0);
      }
    },
  });

  // Publish test message
  await producer.send({
    topic: TOPIC,
    messages: [
      { value: JSON.stringify({ test: 'latency', sentTimestamp }) },
    ],
  });

  // Timeout if not received in 10 seconds
  setTimeout(async () => {
    if (!received) {
      console.error('Latency test failed: message not received in 10s');
      await producer.disconnect();
      await consumer.disconnect();
      process.exit(1);
    }
  }, 10000);
})();
