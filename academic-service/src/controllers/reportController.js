const dbService = require('../services/dbService');
const logger = require('../utils/logger');
const moment = require('moment'); // You will need to npm install moment in academic-service

exports.getStudentAttendanceReport = async (req, res, next) => {
  try {
    const { mahasiswaId, courseId } = req.params;
    const { week } = req.query; // Query parameter for week number

    if (!week) {
        return res.status(400).json({ message: 'Week number is required as a query parameter (e.g., ?week=1).' });
    }

    // You need to determine the start and end date of the requested week.
    // This often depends on the academic calendar, but for simplicity, let's assume
    // the 'week' refers to the Nth week of the year starting from a fixed date,
    // or the Nth week since the course started.
    // For now, let's assume 'week' is a simple identifier or a full date range will be provided.
    // A robust solution would involve academic calendar logic.

    // For a simple example, let's get all attendance for a student in a course
    // and then you can filter by week on the client or add more complex SQL.
    // To implement 'week', you'd typically need a fixed academic year start date
    // or a more sophisticated week numbering system.

    // Let's use a simplified approach where 'week' might imply a date range
    // For the sake of providing a working example, let's assume 'week' is just illustrative
    // and we fetch all for now, or add a basic date range logic.

    // A basic example: get all attendance for a student in a specific course
    const query = `
      SELECT
          asess.session_date,
          asess.start_time as session_open_time,
          asess.end_time as session_close_time,
          a.status,
          a.attendance_time,
          c.course_name,
          c.course_code,
          cl.semester_name,
          cl.major,
          cl.group_name,
          cc.day_of_week,
          cc.start_time as class_time
      FROM attendances a
      JOIN attendance_sessions asess ON a.session_id = asess.session_id
      JOIN class_courses cc ON asess.class_course_id = cc.class_course_id
      JOIN courses c ON cc.course_id = c.course_id
      JOIN classes cl ON cc.class_id = cl.class_id
      WHERE a.student_id = $1 AND cc.course_id = $2
      ORDER BY asess.session_date, cc.start_time;
    `;
    const values = [mahasiswaId, courseId];
    const result = await dbService.query(query, values);

    // If 'week' query parameter is provided, we can filter results here or in SQL
    let filteredResults = result.rows;

    // Example of filtering by week if 'week' implies a specific date range
    // This requires robust date logic based on your academic calendar
    /*
    if (week) {
        // Example: Assume 'week' is the ISO week number of the year
        // This is a complex logic that needs a fixed academic year start date.
        // For simplicity, consider how you define "week" in your system (e.g., academic week 1, 2, 3...)
        // This usually involves calculating dates based on a fixed academic year start date.
        // For now, we'll return all results and note the complexity.
    }
    */

    // To implement "alfa if not present":
    // This typically means, for a given class_course and session_date, if a student
    // *should have* attended but has no entry in the 'attendances' table, they are 'Alfa'.
    // This requires:
    // 1. Knowing which students are enrolled in which class_course (enrollment table needed).
    // 2. A background job or a check when a session closes.
    // This report currently only shows recorded attendances, not implied Alfas.

    res.status(200).json({
        mahasiswa_id: mahasiswaId,
        course_id: courseId,
        report_week: week,
        attendance_records: filteredResults
    });

  } catch (error) {
    logger.error(`Error getting student attendance report: ${error.message}`, error.stack);
    next(error);
  }
};