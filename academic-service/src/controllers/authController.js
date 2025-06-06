const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const passwordUtils = require('../utils/passwordUtils');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Ganti di produksi!

exports.registerLecturer = async (req, res, next) => {
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

    logger.info(`Lecturer registered: ${newLecturer.nidn}`);
    res.status(201).json({ message: 'Lecturer registered successfully.', lecturer: newLecturer });

  } catch (error) {
    logger.error(`Error registering lecturer: ${error.message}`, error.stack);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Lecturer with this NIDN or Email already exists.' });
    }
    next(error);
  }
};

exports.loginLecturer = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and Password are required.' });
    }

    const query = 'SELECT lecturer_id, nidn, name, email, password_hash FROM lecturers WHERE email = $1';
    const result = await dbService.query(query, [email]);
    const lecturer = result.rows[0];

    if (!lecturer) {
      return res.status(401).json({ message: 'Authentication failed: Invalid credentials.' });
    }

    const isMatch = await passwordUtils.comparePassword(password, lecturer.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Authentication failed: Invalid credentials.' });
    }

    const token = jwt.sign(
      { lecturerId: lecturer.lecturer_id, nidn: lecturer.nidn, email: lecturer.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info(`Lecturer logged in: ${lecturer.email}`);
    res.status(200).json({ message: 'Logged in successfully.', token: token });

  } catch (error) {
    logger.error(`Error logging in lecturer: ${error.message}`, error.stack);
    next(error);
  }
};