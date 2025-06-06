const dbService = require('../services/dbService');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

exports.addMahasiswa = async (req, res, next) => {
  try {
    const { nim, nama, jurusan } = req.body;

    if (!nim || !nama || !jurusan) {
      return res.status(400).json({ message: 'NIM, Nama, and Jurusan are required.' });
    }

    // Measure latency for API processing before DB insertion
    const apiProcessingStartTime = process.hrtime.bigint();

    // 1. Tambah data ke DB
    const query = 'INSERT INTO mahasiswa(id, nim, nama, jurusan) VALUES($1, $2, $3, $4) RETURNING *';
    const newMahasiswaId = uuidv4(); // Generate UUID for ID
    const values = [newMahasiswaId, nim, nama, jurusan];
    const result = await dbService.query(query, values);
    const newMahasiswa = result.rows[0];
    logger.info(`Mahasiswa added to DB: ${JSON.stringify(newMahasiswa)}`);

    const apiProcessingEndTime = process.hrtime.bigint();
    const apiProcessingLatencyNs = apiProcessingEndTime - apiProcessingStartTime;

    // 2. Publish event ke Kafka topic
    const eventPayload = {
      type: 'MAHASISWA_ADDED',
      data: {
        id: newMahasiswa.id,
        nim: newMahasiswa.nim,
        nama: newMahasiswa.nama,
        jurusan: newMahasiswa.jurusan
      },
      timestamp_api_sent: Date.now(), // Timestamp saat event dipublish
      trace_id: uuidv4(), // Untuk melacak end-to-end
      api_processing_latency_ns: apiProcessingLatencyNs.toString()
    };

    await kafkaService.publishEvent('mahasiswa_events', eventPayload);
    logger.info(`Event published to Kafka: ${JSON.stringify(eventPayload)}`);

    res.status(201).json({
      message: 'Mahasiswa added successfully and event published.',
      data: newMahasiswa
    });

  } catch (error) {
    logger.error(`Error adding mahasiswa: ${error.message}`, error.stack);
    if (error.code === '23505') { // PostgreSQL unique violation error code
      return res.status(409).json({ message: 'Mahasiswa with this NIM already exists.' });
    }
    next(error); // Pass error to error handling middleware
  }
};

// BARU: Fungsi untuk mendapatkan semua mahasiswa
exports.getAllMahasiswa = async (req, res, next) => {
  try {
    const query = 'SELECT id, nim, nama, jurusan, created_at, updated_at FROM mahasiswa ORDER BY nim ASC';
    const result = await dbService.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting all mahasiswa: ${error.message}`, error.stack);
    next(error);
  }
};

// BARU: Fungsi untuk mendapatkan mahasiswa berdasarkan ID
exports.getMahasiswaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = 'SELECT id, nim, nama, jurusan, created_at, updated_at FROM mahasiswa WHERE id = $1';
    const result = await dbService.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Mahasiswa not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting mahasiswa by ID ${req.params.id}: ${error.stack}`);
    next(error);
  }
};

// BARU: Fungsi untuk mendapatkan mahasiswa berdasarkan NIM
exports.getMahasiswaByNim = async (req, res, next) => {
  try {
    const { nim } = req.params;
    const query = 'SELECT id, nim, nama, jurusan, created_at, updated_at FROM mahasiswa WHERE nim = $1';
    const result = await dbService.query(query, [nim]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Mahasiswa not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting mahasiswa by NIM ${req.params.nim}: ${error.stack}`);
    next(error);
  }
};