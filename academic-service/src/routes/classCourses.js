const express = require('express');
const router = express.Router();
const classCourseController = require('../controllers/classCourseController');
const { authenticateLecturer } = require('../middleware/authMiddleware');

// All class-course operations require lecturer authentication
router.post('/', authenticateLecturer, classCourseController.addClassCourse);
router.get('/', authenticateLecturer, classCourseController.getAllClassCourses);
router.get('/:id', authenticateLecturer, classCourseController.getClassCourseById);
router.put('/:id', authenticateLecturer, classCourseController.updateClassCourse);
router.delete('/:id', authenticateLecturer, classCourseController.deleteClassCourse);
router.get('/class/:classId', authenticateLecturer, classCourseController.getClassCoursesByClassId); // New specific endpoint

module.exports = router;