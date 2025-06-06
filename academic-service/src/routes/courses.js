const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { authenticateLecturer } = require('../middleware/authMiddleware');

// All course operations require lecturer authentication
router.post('/', authenticateLecturer, courseController.addCourse);
router.get('/', authenticateLecturer, courseController.getAllCourses);
router.get('/:id', authenticateLecturer, courseController.getCourseById);
router.put('/:id', authenticateLecturer, courseController.updateCourse);
router.delete('/:id', authenticateLecturer, courseController.deleteCourse);

module.exports = router;