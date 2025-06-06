const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');

exports.addClassCourse = async (req, res, next) => {
  try {
    const { class_id, course_id, day_of_week, start_time, end_time, room } = req.body;
    if (!class_id || !course_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ message: 'Class ID, Course ID, Day of Week, Start Time, and End Time are required.' });
    }

    // Optional: Verify if class_id and course_id exist
    const classExists = await dbService.query('SELECT class_id FROM classes WHERE class_id = $1', [class_id]);
    if (classExists.rows.length === 0) {
        return res.status(404).json({ message: 'Class not found.' });
    }
    const courseExists = await dbService.query('SELECT course_id FROM courses WHERE course_id = $1', [course_id]);
    if (courseExists.rows.length === 0) {
        return res.status(404).json({ message: 'Course not found.' });
    }

    const classCourseId = uuidv4();
    const query = 'INSERT INTO class_courses(class_course_id, class_id, course_id, day_of_week, start_time, end_time, room) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *';
    const values = [classCourseId, class_id, course_id, day_of_week, start_time, end_time, room];
    const result = await dbService.query(query, values);
    const newClassCourse = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'CLASS_COURSE_ADDED',
      data: newClassCourse,
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Class-Course added: Class ${class_id}, Course ${course_id} by ${req.lecturer.nidn}`);
    res.status(201).json({ message: 'Class-Course added successfully.', classCourse: newClassCourse });

  } catch (error) {
    logger.error(`Error adding class-course: ${error.message}`, error.stack);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Class already has this course or another course at the same time.' });
    }
    next(error);
  }
};

exports.getAllClassCourses = async (req, res, next) => {
  try {
    const result = await dbService.query('SELECT * FROM class_courses');
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting all class-courses: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getClassCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('SELECT * FROM class_courses WHERE class_course_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class-Course not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting class-course by ID: ${error.message}`, error.stack);
    next(error);
  }
};

exports.updateClassCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { day_of_week, start_time, end_time, room } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (day_of_week) { fields.push(`day_of_week = $${paramIndex++}`); values.push(day_of_week); }
    if (start_time) { fields.push(`start_time = $${paramIndex++}`); values.push(start_time); }
    if (end_time) { fields.push(`end_time = $${paramIndex++}`); values.push(end_time); }
    if (room) { fields.push(`room = $${paramIndex++}`); values.push(room); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    values.push(id);
    const query = `UPDATE class_courses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE class_course_id = $${paramIndex} RETURNING *`;
    const result = await dbService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class-Course not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'CLASS_COURSE_UPDATED',
      data: result.rows[0],
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Class-Course updated: ${id} by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Class-Course updated successfully.', classCourse: result.rows[0] });

  } catch (error) {
    logger.error(`Error updating class-course: ${error.message}`, error.stack);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Another class course exists at the same time for this class.' });
    }
    next(error);
  }
};

exports.deleteClassCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('DELETE FROM class_courses WHERE class_course_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Class-Course not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'CLASS_COURSE_DELETED',
      data: { class_course_id: id, class_id: result.rows[0].class_id, course_id: result.rows[0].course_id },
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Class-Course deleted: ${id} by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Class-Course deleted successfully.' });

  } catch (error) {
    logger.error(`Error deleting class-course: ${error.message}`, error.stack);
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Cannot delete class course: associated attendance sessions exist.' });
    }
    next(error);
  }
};

exports.getClassCoursesByClassId = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const query = `
      SELECT cc.*, c.course_name, c.course_code, l.name as lecturer_name
      FROM class_courses cc
      JOIN courses c ON cc.course_id = c.course_id
      JOIN lecturers l ON c.lecturer_id = l.lecturer_id
      WHERE cc.class_id = $1
      ORDER BY cc.day_of_week, cc.start_time;
    `;
    const result = await dbService.query(query, [classId]);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting class-courses for class ID ${classId}: ${error.message}`, error.stack);
    next(error);
  }
};