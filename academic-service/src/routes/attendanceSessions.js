const express = require('express');
const router = express.Router();
const attendanceSessionController = require('../controllers/attendanceSessionController');
const { authenticateLecturer } = require('../middleware/authMiddleware');

// All attendance session operations require lecturer authentication
router.post('/', authenticateLecturer, attendanceSessionController.openAttendanceSession);
router.put('/:id/close', authenticateLecturer, attendanceSessionController.closeAttendanceSession);
router.get('/active', authenticateLecturer, attendanceSessionController.getActiveSessions);
router.get('/:id', authenticateLecturer, attendanceSessionController.getAttendanceSessionById);
router.get('/class-course/:classCourseId', authenticateLecturer, attendanceSessionController.getAttendanceSessionsByClassCourseId);

module.exports = router;