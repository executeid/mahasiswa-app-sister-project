const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');

exports.addCourse = async (req, res, next) => {
  try {
    const { course_code, course_name, sks, lecturer_id } = req.body; // lecturer_id harus disediakan
    if (!course_code || !course_name || !sks || !lecturer_id) {
      return res.status(400).json({ message: 'Course Code, Name, SKS, and Lecturer ID are required.' });
    }

    // Optional: Verify if lecturer_id exists in 'lecturers' table before inserting
    const lecturerExists = await dbService.query('SELECT lecturer_id FROM lecturers WHERE lecturer_id = $1', [lecturer_id]);
    if (lecturerExists.rows.length === 0) {
        return res.status(404).json({ message: 'Lecturer not found.' });
    }

    const courseId = uuidv4();
    const query = 'INSERT INTO courses(course_id, course_code, course_name, sks, lecturer_id) VALUES($1, $2, $3, $4, $5) RETURNING *';
    const values = [courseId, course_code, course_name, sks, lecturer_id];
    const result = await dbService.query(query, values);
    const newCourse = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'COURSE_ADDED',
      data: newCourse,
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Course added: ${newCourse.course_code} by lecturer ${req.lecturer.nidn}`);
    res.status(201).json({ message: 'Course added successfully.', course: newCourse });

  } catch (error) {
    logger.error(`Error adding course: ${error.message}`, error.stack);
    if (error.code === '23505') { // Unique violation on course_code
      return res.status(409).json({ message: 'Course with this code already exists.' });
    }
    next(error);
  }
};

exports.getAllCourses = async (req, res, next) => {
  try {
    // Optional: filter by lecturer_id from authenticated user
    const result = await dbService.query('SELECT * FROM courses');
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting all courses: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('SELECT * FROM courses WHERE course_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting course by ID: ${error.message}`, error.stack);
    next(error);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { course_name, sks, lecturer_id } = req.body;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (course_name) { fields.push(`course_name = $${paramIndex++}`); values.push(course_name); }
    if (sks) { fields.push(`sks = $${paramIndex++}`); values.push(sks); }
    if (lecturer_id) { fields.push(`lecturer_id = $${paramIndex++}`); values.push(lecturer_id); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    values.push(id);
    const query = `UPDATE courses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE course_id = $${paramIndex} RETURNING *`;
    const result = await dbService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'COURSE_UPDATED',
      data: result.rows[0],
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Course updated: ${id} by lecturer ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Course updated successfully.', course: result.rows[0] });

  } catch (error) {
    logger.error(`Error updating course: ${error.message}`, error.stack);
    next(error);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await dbService.query('DELETE FROM courses WHERE course_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'COURSE_DELETED',
      data: { course_id: id, course_code: result.rows[0].course_code },
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Course deleted: ${id} by lecturer ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Course deleted successfully.' });

  } catch (error) {
    logger.error(`Error deleting course: ${error.message}`, error.stack);
    if (error.code === '23503') { // PostgreSQL foreign key violation
      return res.status(409).json({ message: 'Cannot delete course: associated class courses or attendance sessions exist.' });
    }
    next(error);
  }
};