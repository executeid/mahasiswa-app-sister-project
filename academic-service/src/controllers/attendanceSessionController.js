const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');

exports.openAttendanceSession = async (req, res, next) => {
  try {
    const { class_course_id, session_date } = req.body;
    if (!class_course_id || !session_date) {
      return res.status(400).json({ message: 'Class-Course ID and Session Date are required.' });
    }

    // Verify class_course_id exists and is taught by the authenticated lecturer
    const classCourseInfo = await dbService.query(`
      SELECT cc.class_course_id, c.lecturer_id
      FROM class_courses cc
      JOIN courses c ON cc.course_id = c.course_id
      WHERE cc.class_course_id = $1
    `, [class_course_id]);

    if (classCourseInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Class-Course not found.' });
    }
    if (classCourseInfo.rows[0].lecturer_id !== req.lecturer.lecturerId) {
      return res.status(403).json({ message: 'Forbidden: You are not the lecturer for this course.' });
    }

    const sessionId = uuidv4();
    const currentTime = new Date();
    const query = 'INSERT INTO attendance_sessions(session_id, class_course_id, session_date, start_time, is_open) VALUES($1, $2, $3, $4, TRUE) RETURNING *';
    const values = [sessionId, class_course_id, session_date, currentTime];
    const result = await dbService.query(query, values);
    const newSession = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'ATTENDANCE_SESSION_OPENED',
      data: newSession,
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Attendance session opened for Class-Course ${class_course_id} on ${session_date} by ${req.lecturer.nidn}`);
    res.status(201).json({ message: 'Attendance session opened successfully.', session: newSession });

  } catch (error) {
    logger.error(`Error opening attendance session: ${error.message}`, error.stack);
    if (error.code === '23505') { // Unique violation (session already exists for this class-course on this date)
      return res.status(409).json({ message: 'Attendance session already exists for this course on this date.' });
    }
    next(error);
  }
};

exports.closeAttendanceSession = async (req, res, next) => {
  try {
    const { id } = req.params; // session_id

    // Verify session belongs to authenticated lecturer
    const sessionInfo = await dbService.query(`
      SELECT asess.session_id, c.lecturer_id
      FROM attendance_sessions asess
      JOIN class_courses cc ON asess.class_course_id = cc.class_course_id
      JOIN courses c ON cc.course_id = c.course_id
      WHERE asess.session_id = $1
    `, [id]);

    if (sessionInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Attendance session not found.' });
    }
    if (sessionInfo.rows[0].lecturer_id !== req.lecturer.lecturerId) {
      return res.status(403).json({ message: 'Forbidden: You are not authorized to close this session.' });
    }

    const currentTime = new Date();
    const query = 'UPDATE attendance_sessions SET is_open = FALSE, end_time = $1, updated_at = CURRENT_TIMESTAMP WHERE session_id = $2 AND is_open = TRUE RETURNING *';
    const result = await dbService.query(query, [currentTime, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found or already closed.' });
    }
    const closedSession = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'ATTENDANCE_SESSION_CLOSED',
      data: closedSession,
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Attendance session ${id} closed by ${req.lecturer.nidn}`);
    res.status(200).json({ message: 'Attendance session closed successfully.', session: closedSession });

  } catch (error) {
    logger.error(`Error closing attendance session: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getActiveSessions = async (req, res, next) => {
  try {
    const query = `
      SELECT asess.*, cc.day_of_week, cc.start_time as class_start_time, cc.end_time as class_end_time,
             c.course_code, c.course_name,
             cl.semester_name, cl.major, cl.group_name
      FROM attendance_sessions asess
      JOIN class_courses cc ON asess.class_course_id = cc.class_course_id
      JOIN courses c ON cc.course_id = c.course_id
      JOIN classes cl ON cc.class_id = cl.class_id
      WHERE asess.is_open = TRUE
      ORDER BY asess.start_time DESC;
    `;
    const result = await dbService.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting active attendance sessions: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getAttendanceSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT asess.*, cc.day_of_week, cc.start_time as class_start_time, cc.end_time as class_end_time,
             c.course_code, c.course_name,
             cl.semester_name, cl.major, cl.group_name
      FROM attendance_sessions asess
      JOIN class_courses cc ON asess.class_course_id = cc.class_course_id
      JOIN courses c ON cc.course_id = c.course_id
      JOIN classes cl ON cc.class_id = cl.class_id
      WHERE asess.session_id = $1;
    `;
    const result = await dbService.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Attendance session not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error(`Error getting attendance session by ID: ${error.message}`, error.stack);
    next(error);
  }
};

exports.getAttendanceSessionsByClassCourseId = async (req, res, next) => {
  try {
    const { classCourseId } = req.params;
    const query = `
      SELECT asess.*, cl.semester_name, cl.major, cl.group_name, c.course_code, c.course_name
      FROM attendance_sessions asess
      JOIN class_courses cc ON asess.class_course_id = cc.class_course_id
      JOIN classes cl ON cc.class_id = cl.class_id
      JOIN courses c ON cc.course_id = c.course_id
      WHERE asess.class_course_id = $1
      ORDER BY asess.session_date DESC;
    `;
    const result = await dbService.query(query, [classCourseId]);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting attendance sessions for class-course ID ${classCourseId}: ${error.message}`, error.stack);
    next(error);
  }
};