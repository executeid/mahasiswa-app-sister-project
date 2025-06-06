const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');

exports.addClass = async (req, res, next) => {
  try {
    const { semester_name, major, group_name } = req.body;
    if (!semester_name || !major || !group_name) {
      return res.status(400).json({ message: 'Semester Name, Major, and Group Name are required.' });
    }

    const classId = uuidv4();
    const query = 'INSERT INTO classes(class_id, semester_name, major, group_name) VALUES($1, $2, $3, $4) RETURNING *';
    const values = [classId, semester_name, major, group_name];
    const result = await dbService.query(query, values);
    const newClass = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'CLASS_ADDED',
      data: newClass,
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Class added: ${newClass.semester_name} ${newClass.major} ${newClass.group_name} by ${req.lecturer.nidn}`);
    res.status(201).json({ message: 'Class added successfully.', class: newClass });

  } catch (error) {
    logger.error(`Error adding class: ${error.message}`, error.stack);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Class with this semester, major, and group already exists.' });
    }
    next(error);
  }
};

exports.getAllClasses = async (req, res, next) => {
  try {
    const result = await dbService.query('SELECT * FROM classes');
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting all classes: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getClassById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('SELECT * FROM classes WHERE class_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting class by ID: ${error.message}`, error.stack);
    next(error);
  }
};

exports.updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { semester_name, major, group_name } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (semester_name) { fields.push(`semester_name = $${paramIndex++}`); values.push(semester_name); }
    if (major) { fields.push(`major = $${paramIndex++}`); values.push(major); }
    if (group_name) { fields.push(`group_name = $${paramIndex++}`); values.push(group_name); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    values.push(id);
    const query = `UPDATE classes SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE class_id = $${paramIndex} RETURNING *`;
    const result = await dbService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'CLASS_UPDATED',
      data: result.rows[0],
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Class updated: ${id} by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Class updated successfully.', class: result.rows[0] });

  } catch (error) {
    logger.error(`Error updating class: ${error.message}`, error.stack);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Class with this semester, major, and group already exists.' });
    }
    next(error);
  }
};

exports.deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('DELETE FROM classes WHERE class_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'CLASS_DELETED',
      data: { class_id: id, semester_name: result.rows[0].semester_name },
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Class deleted: ${id} by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Class deleted successfully.' });

  } catch (error) {
    logger.error(`Error deleting class: ${error.message}`, error.stack);
    if (error.code === '23503') { // PostgreSQL foreign key violation
      return res.status(409).json({ message: 'Cannot delete class: associated class courses exist.' });
    }
    next(error);
  }
};