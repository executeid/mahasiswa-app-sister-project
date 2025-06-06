const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticateLecturer } = require('../middleware/authMiddleware');

// All class operations require lecturer authentication
router.post('/', authenticateLecturer, classController.addClass);
router.get('/', authenticateLecturer, classController.getAllClasses);
router.get('/:id', authenticateLecturer, classController.getClassById);
router.put('/:id', authenticateLecturer, classController.updateClass);
router.delete('/:id', authenticateLecturer, classController.deleteClass);

module.exports = router;