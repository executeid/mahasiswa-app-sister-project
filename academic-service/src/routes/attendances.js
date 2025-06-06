const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateLecturer } = require('../middleware/authMiddleware'); // For lecturer actions
// const { authenticateStudent } = require('../middleware/authMiddleware'); // If you implement student login later

// Endpoint for students to record attendance (requires student ID, session ID)
// For now, assume this is handled by an authorized client or a dedicated student API later
router.post('/', attendanceController.recordAttendance);

// Lecturers can view/manage attendances for a session
router.get('/session/:sessionId', authenticateLecturer, attendanceController.getAttendancesBySessionId);

module.exports = router;