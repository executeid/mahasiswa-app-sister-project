// tests/utils.js
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const axios = require('axios');
const moment = require('moment'); // Diperlukan untuk getCurrentAcademicWeek

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createKafkaConsumer = (brokers, groupId, topic) => {
    const kafka = new Kafka({ clientId: `test-consumer-${groupId}-${Date.now()}`, brokers });
    const consumer = kafka.consumer({ groupId });
    let messages = [];

    const start = async () => {
        await consumer.connect();
        // fromBeginning: true untuk membaca semua pesan dari awal topik
        // fromBeginning: false untuk membaca hanya pesan baru
        await consumer.subscribe({ topic, fromBeginning: true });
        consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                messages.push(JSON.parse(message.value.toString()));
            },
        });
        console.log(`Kafka Consumer for topic ${topic} (group: ${groupId}) started.`);
    };

    const stop = async () => {
        await consumer.disconnect();
        console.log(`Kafka Consumer for topic ${topic} (group: ${groupId}) stopped.`);
    };

    const getMessages = () => messages;
    const clearMessages = () => { messages = []; };

    return { start, stop, getMessages, clearMessages };
};

const createPgPool = (dbConfig) => {
    const pool = new Pool(dbConfig);
    pool.on('error', (err) => console.error('Unexpected error on idle DB client', err));
    return {
        query: (text, params) => pool.query(text, params),
        end: () => pool.end(),
        connect: async () => {
            try {
                await pool.query('SELECT NOW()');
                console.log(`Connected to DB: ${dbConfig.database}`);
            } catch (err) {
                console.error(`Failed to connect to DB: ${dbConfig.database}`, err);
                throw err;
            }
        }
    };
};

const getAuthToken = async (loginUrl, email, password) => {
    try {
        const response = await axios.post(loginUrl, { email, password });
        return response.data.token;
    } catch (error) {
        console.error('Failed to get auth token:', error.response ? error.response.data : error.message);
        throw error;
    }
};

const getCurrentAcademicWeek = (academicYearStartDate, currentDate) => {
    // academicYearStartDate should be a moment object or Date
    // currentDate should be a moment object or Date
    const startOfYear = moment(academicYearStartDate).startOf('isoWeek');
    const diffWeeks = moment(currentDate).diff(startOfYear, 'weeks');
    return diffWeeks + 1; // Week numbers usually start from 1
};


module.exports = {
    sleep,
    createKafkaConsumer,
    createPgPool,
    getAuthToken,
    getCurrentAcademicWeek,
    axios // Export axios directly for API calls
};