const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateLecturer } = require('../middleware/authMiddleware');

// Report endpoint for lecturer (e.g., /reports/attendance/mahasiswa/:mahasiswaId/course/:courseId?week=N)
router.get('/attendance/mahasiswa/:mahasiswaId/course/:courseId', authenticateLecturer, reportController.getStudentAttendanceReport);

module.exports = router;