const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const passwordUtils = require('../utils/passwordUtils');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');

exports.addLecturer = async (req, res, next) => {
  try {
    const { nidn, name, email, password } = req.body;
    if (!nidn || !name || !email || !password) {
      return res.status(400).json({ message: 'NIDN, Name, Email, and Password are required.' });
    }

    const passwordHash = await passwordUtils.hashPassword(password);
    const lecturerId = uuidv4();

    const query = 'INSERT INTO lecturers(lecturer_id, nidn, name, email, password_hash) VALUES($1, $2, $3, $4, $5) RETURNING lecturer_id, nidn, name, email';
    const values = [lecturerId, nidn, name, email, passwordHash];
    const result = await dbService.query(query, values);
    const newLecturer = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'LECTURER_ADDED',
      data: newLecturer,
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Lecturer added: ${newLecturer.nidn} by ${req.lecturer.nidn}`);
    res.status(201).json({ message: 'Lecturer added successfully.', lecturer: newLecturer });

  } catch (error) {
    logger.error(`Error adding lecturer: ${error.message}`, error.stack);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Lecturer with this NIDN or Email already exists.' });
    }
    next(error);
  }
};

exports.getAllLecturers = async (req, res, next) => {
  try {
    const result = await dbService.query('SELECT lecturer_id, nidn, name, email FROM lecturers');
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting all lecturers: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getLecturerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('SELECT lecturer_id, nidn, name, email FROM lecturers WHERE lecturer_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lecturer not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting lecturer by ID: ${error.message}`, error.stack);
    next(error);
  }
};

exports.updateLecturer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    let passwordHash;
    if (password) {
      passwordHash = await passwordUtils.hashPassword(password);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (email) { fields.push(`email = $${paramIndex++}`); values.push(email); }
    if (passwordHash) { fields.push(`password_hash = $${paramIndex++}`); values.push(passwordHash); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    values.push(id);
    const query = `UPDATE lecturers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE lecturer_id = $${paramIndex} RETURNING lecturer_id, nidn, name, email`;
    const result = await dbService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lecturer not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'LECTURER_UPDATED',
      data: result.rows[0],
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Lecturer updated: ${id} by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Lecturer updated successfully.', lecturer: result.rows[0] });

  } catch (error) {
    logger.error(`Error updating lecturer: ${error.message}`, error.stack);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already exists.' });
    }
    next(error);
  }
};

exports.deleteLecturer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('DELETE FROM lecturers WHERE lecturer_id = $1 RETURNING lecturer_id, nidn', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lecturer not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'LECTURER_DELETED',
      data: { lecturer_id: id, nidn: result.rows[0].nidn },
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Lecturer deleted: ${id} by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Lecturer deleted successfully.' });

  } catch (error) {
    logger.error(`Error deleting lecturer: ${error.message}`, error.stack);
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Cannot delete lecturer: associated courses exist.' });
    }
    next(error);
  }
};