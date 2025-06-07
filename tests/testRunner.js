// tests/testRunner.js
const {
    API_ENDPOINTS,
    KAFKA_BROKERS,
    KAFKA_TOPIC_MAHASISWA_EVENTS,
    KAFKA_TOPIC_ACADEMIC_EVENTS,
    DB_CONFIG_LOG,
    DB_CONFIG_MAHASISWA,
    LECTURER_CREDENTIALS,
    uuidv4
} = require('./configs');
const {
    sleep,
    createKafkaConsumer,
    createPgPool,
    getAuthToken,
    axios
} = require('./utils');

let kafkaMahasiswaConsumer;
let kafkaAcademicConsumer; // Diperlukan untuk Academic Service Sync Test
let dbLogPool;
let dbMahasiswaPool;
let dbAcademicPool; // Diperlukan untuk Academic Service Sync Test
let jwtToken;
let lecturerId;
let courseId;
let classId;
let classCourseId;
let studentId;
let attendanceSessionId;

const log = (message) => console.log(`[TEST] ${message}`);
const error = (message) => console.error(`[ERROR] ${message}`);

const runTest = async (name, testFunction) => {
    log(`--- Running Test: ${name} ---`);
    try {
        await testFunction();
        log(`--- PASSED: ${name} ---`);
        return true;
    } catch (err) {
        error(`--- FAILED: ${name} ---`);
        error(err.message);
        if (err.response) {
            error(`Response Status: ${err.response.status}`);
            error(`Response Data: ${JSON.stringify(err.response.data)}`);
        }
        return false;
    } finally {
        console.log('\n');
    }
};

const setup = async () => {
    log('Setting up test environment...');
    dbLogPool = createPgPool(DB_CONFIG_LOG);
    dbMahasiswaPool = createPgPool(DB_CONFIG_MAHASISWA);
    // Asumsi DB Academic juga perlu diakses langsung untuk verifikasi sync test
    // Tambahkan DB_CONFIG_ACADEMIC di configs.js jika perlu
    // const DB_CONFIG_ACADEMIC = { /* ... */ };
    // dbAcademicPool = createPgPool(DB_CONFIG_ACADEMIC); // Uncomment if needed

    await dbLogPool.connect();
    await dbMahasiswaPool.connect();
    // await dbAcademicPool.connect(); // Uncomment if needed

    // Start Kafka Consumers for monitoring
    kafkaMahasiswaConsumer = createKafkaConsumer(KAFKA_BROKERS, 'test-group-mahasiswa', KAFKA_TOPIC_MAHASISWA_EVENTS);
    await kafkaMahasiswaConsumer.start();

    // Untuk Academic Event, hanya diperlukan jika menguji integrasi Academic Service
    kafkaAcademicConsumer = createKafkaConsumer(KAFKA_BROKERS, 'test-group-academic', KAFKA_TOPIC_ACADEMIC_EVENTS);
    await kafkaAcademicConsumer.start();

    log('Setup complete.');
};

const cleanup = async () => {
    log('Cleaning up test environment...');
    if (kafkaMahasiswaConsumer) await kafkaMahasiswaConsumer.stop();
    if (kafkaAcademicConsumer) await kafkaAcademicConsumer.stop(); // Stop consumer academic
    if (dbLogPool) await dbLogPool.end();
    if (dbMahasiswaPool) await dbMahasiswaPool.end();
    // if (dbAcademicPool) await dbAcademicPool.end(); // Uncomment if used
    log('Cleanup complete.');
};

const main = async () => {
    let overallStatus = true;

    await setup();

    // --- Skenario Pengujian Sistem Utama ---

    // 1. Event Publish Test: Tambah mahasiswa
    overallStatus = await runTest('Event Publish Test: Mahasiswa Added', async () => {
        kafkaMahasiswaConsumer.clearMessages(); // Bersihkan pesan sebelum test
        const testNim = `NIM-${uuidv4().substring(0, 8)}`;
        const addMahasiswaResponse = await axios.post(API_ENDPOINTS.mahasiswa, {
            nim: testNim,
            nama: "Mahasiswa Test",
            jurusan: "TI"
        });
        if (addMahasiswaResponse.status !== 201) {
          throw new Error(`API returned non-201 status: ${addMahasiswaResponse.status}`);
        }

        await sleep(5000); // Beri waktu Kafka untuk memproses dan consumer untuk menerima

        const receivedMessages = kafkaMahasiswaConsumer.getMessages();
        const foundEvent = receivedMessages.find(msg =>
            msg.type === 'MAHASISWA_ADDED' && msg.data.nim === testNim
        );

        if (!foundEvent) {
          throw new Error('Mahasiswa_ADDED event not found in Kafka topic (Consumer did not receive it).');
        }

        studentId = foundEvent.data.id; // Simpan ID mahasiswa untuk test selanjutnya
        log(`Mahasiswa ${testNim} added. Event found in Kafka. Student ID: ${studentId}`);
    }) && overallStatus;

    // 2. Consumer Test: Log ke DB
    overallStatus = await runTest('Consumer Test: Mahasiswa Logged to DB', async () => {
        await sleep(3000); // Beri waktu consumer untuk memproses
        const result = await dbLogPool.query(
            `SELECT event_type, event_data FROM event_logs WHERE event_data->>'id' = $1 ORDER BY timestamp_db_saved DESC LIMIT 1`,
            [studentId]
        );
        if (result.rows.length === 0) {
          throw new Error('Mahasiswa event not found in log DB (Consumer did not write it).');
        }
        log(`Mahasiswa event for ${studentId} found in log DB.`);
    }) && overallStatus;

    // 3. Integration Test: Data Mahasiswa ke DB Mahasiswa
    overallStatus = await runTest('Integration Test: Mahasiswa Data to Mahasiswa DB', async () => {
        const result = await dbMahasiswaPool.query(
            `SELECT id, nim, nama, jurusan FROM mahasiswa WHERE id = $1`,
            [studentId]
        );
        if (result.rows.length === 0) {
          throw new Error('Mahasiswa data not found in Mahasiswa DB.');
        }
        log(`Mahasiswa data for ${studentId} found in Mahasiswa DB.`);
    }) && overallStatus;

    // --- Uji API GET Mahasiswa ---
    overallStatus = await runTest('GET Mahasiswa: Get All Mahasiswa', async () => {
        const response = await axios.get(API_ENDPOINTS.mahasiswa);
        if (response.status !== 200) {
          throw new Error(`API returned non-200 status: ${response.status}`);
        }
        if (!Array.isArray(response.data) || response.data.length === 0) {
          log('Warning: No mahasiswa found in list.');
        }
        log(`Successfully retrieved ${response.data.length} mahasiswa.`);
    }) && overallStatus;

    overallStatus = await runTest('GET Mahasiswa: Get Mahasiswa By ID', async () => {
        if (!studentId) {
          throw new Error('Skipping: No student ID available from previous tests.');
        }
        const response = await axios.get(`${API_ENDPOINTS.mahasiswa}/${studentId}`);
        if (response.status !== 200) {
          throw new Error(`API returned non-200 status: ${response.status}`);
        }
        if (response.data.id !== studentId) {
          throw new Error('Retrieved student ID does not match expected.');
        }
        log(`Successfully retrieved mahasiswa by ID: ${studentId}`);
    }) && overallStatus;

    overallStatus = await runTest('GET Mahasiswa: Get Mahasiswa By NIM', async () => {
        if (!studentId) {
          throw new Error('Skipping: No student ID available from previous tests.');
        }
        const dbResult = await dbMahasiswaPool.query(`SELECT nim FROM mahasiswa WHERE id = $1`, [studentId]);
        if (dbResult.rows.length === 0) {
            throw new Error('Could not retrieve NIM for testing GET by NIM.');
        }
        const testNim = dbResult.rows[0].nim;

        const response = await axios.get(`${API_ENDPOINTS.mahasiswa}/nim/${testNim}`);
        if (response.status !== 200) {
          throw new Error(`API returned non-200 status: ${response.status}`);
        }
        if (response.data.nim !== testNim) {
          throw new Error('Retrieved student NIM does not match expected.');
        }
        log(`Successfully retrieved mahasiswa by NIM: ${testNim}`);
    }) && overallStatus;

    // --- End of Main System Tests ---

    // --- Jika ingin menguji fitur Akademik (uncomment bagian di bawah) ---
    /*
    overallStatus = await runTest('Integration Test: Academic Events to Log DB', async () => {
        kafkaAcademicConsumer.clearMessages();
        const newCourseCode = `COURSE-${uuidv4().substring(0, 6)}`;
        // Anda perlu memastikan lecturerId sudah didapatkan dari setup atau di configs.js
        if (!lecturerId) {
            // Register and login lecturer to get JWT token
            log('Registering test lecturer...');
            try {
                await axios.post(`${API_ENDPOINTS.academic}/auth/register`, LECTURER_CREDENTIALS);
                log('Test lecturer registered.');
            } catch (err) {
                if (err.response && err.response.status === 409) {
                    log('Test lecturer already exists, proceeding to login.');
                } else {
                    throw err;
                }
            }

            log('Logging in test lecturer...');
            jwtToken = await getAuthToken(`${API_ENDPOINTS.academic}/auth/login`, LECTURER_CREDENTIALS.email, LECTURER_CREDENTIALS.password);
            log('Logged in successfully. JWT Token obtained.');

            const lecturerResponse = await axios.get(`${API_ENDPOINTS.academic}/lecturers`, {
                headers: { Authorization: `Bearer ${jwtToken}` }
            });
            lecturerId = lecturerResponse.data.find(l => l.nidn === LECTURER_CREDENTIALS.nidn).lecturer_id;
            log(`Obtained lecturer_id: ${lecturerId}`);
        }

        const addCourseResponse = await axios.post(`${API_ENDPOINTS.academic}/courses`, {
            course_code: newCourseCode,
            course_name: `Test Course ${newCourseCode}`,
            sks: 2,
            lecturer_id: lecturerId
        }, {
            headers: { Authorization: `Bearer ${jwtToken}` }
        });
        if (addCourseResponse.status !== 201) throw new Error(`Academic API returned ${addCourseResponse.status}`);

        await sleep(5000); // Give time for Kafka & consumer to process

        const receivedMessages = kafkaAcademicConsumer.getMessages();
        const foundEvent = receivedMessages.find(msg =>
            msg.type === 'COURSE_ADDED' && msg.data.course_code === newCourseCode
        );

        if (!foundEvent) throw new Error('COURSE_ADDED event not found in Kafka topic.');

        const result = await dbLogPool.query(
            `SELECT event_type, event_data FROM event_logs WHERE event_data->>'course_code' = $1 ORDER BY timestamp_db_saved DESC LIMIT 1`,
            [newCourseCode]
        );
        if (result.rows.length === 0) throw new Error('Course event not found in log DB.');
        log(`Course ${newCourseCode} event found in Kafka and log DB.`);
    }) && overallStatus;
    */
    // --- Akhir Bagian Tes Akademik ---


    log('--- All system tests complete ---');
    if (overallStatus) {
        log('All system tests PASSED successfully!');
    } else {
        error('Some system tests FAILED. Check logs above for details.');
        process.exit(1);
    }

    await cleanup();
};

main();