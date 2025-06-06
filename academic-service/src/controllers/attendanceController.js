const { v4: uuidv4 } = require('uuid');
const dbService = require('../services/dbService');
const kafkaService = require('../services/kafkaService');
const logger = require('../utils/logger');

exports.recordAttendance = async (req, res, next) => {
  try {
    const { session_id, student_id, status = 'Hadir' } = req.body; // Default status to 'Hadir'
    if (!session_id || !student_id) {
      return res.status(400).json({ message: 'Session ID and Student ID are required.' });
    }

    // 1. Verify session is open
    const sessionInfo = await dbService.query('SELECT is_open FROM attendance_sessions WHERE session_id = $1', [session_id]);
    if (sessionInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Attendance session not found.' });
    }
    if (!sessionInfo.rows[0].is_open) {
      return res.status(403).json({ message: 'Attendance session is closed.' });
    }

    // 2. Verify student_id exists in local copy
    const studentInfo = await dbService.query('SELECT student_id, nim, name FROM students_local_copy WHERE student_id = $1', [student_id]);
    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found in local copy.' });
    }

    const attendanceTime = new Date();
    const attendanceId = uuidv4();
    const query = 'INSERT INTO attendances(attendance_id, session_id, student_id, status, attendance_time) VALUES($1, $2, $3, $4, $5) RETURNING *';
    const values = [attendanceId, session_id, student_id, status, attendanceTime];
    const result = await dbService.query(query, values);
    const newAttendance = result.rows[0];

    await kafkaService.publishEvent(process.env.KAFKA_TOPIC_ACADEMIC_EVENTS || 'academic_events', {
      type: 'ATTENDANCE_RECORDED',
      data: {
        attendance: newAttendance,
        student_nim: studentInfo.rows[0].nim,
        student_name: studentInfo.rows[0].name
      },
      timestamp: Date.now(),
      trace_id: uuidv4()
    });

    logger.info(`Attendance recorded for student ${student_id} in session ${session_id}`);
    res.status(201).json({ message: 'Attendance recorded successfully.', attendance: newAttendance });

  } catch (error) {
    logger.error(`Error recording attendance: ${error.message}`, error.stack);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ message: 'Student already recorded attendance for this session.' });
    }
    next(error);
  }
};

exports.getAttendancesBySessionId = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const query = `
      SELECT a.*, slc.nim, slc.name as student_name
      FROM attendances a
      JOIN students_local_copy slc ON a.student_id = slc.student_id
      WHERE a.session_id = $1
      ORDER BY slc.nim;
    `;
    const result = await dbService.query(query, [sessionId]);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting attendances for session ${sessionId}: ${error.message}`, error.stack);
    next(error);
  }
};