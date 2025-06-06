const express = require('express');
const router = express.Router();
const lecturerController = require('../controllers/lecturerController');
const { authenticateLecturer } = require('../middleware/authMiddleware');

// Lecturer CRUD (requires authentication for most)
router.post('/', authenticateLecturer, lecturerController.addLecturer); // Lecturer adds another lecturer
router.get('/', authenticateLecturer, lecturerController.getAllLecturers);
router.get('/:id', authenticateLecturer, lecturerController.getLecturerById);
router.put('/:id', authenticateLecturer, lecturerController.updateLecturer);
router.delete('/:id', authenticateLecturer, lecturerController.deleteLecturer);

module.exports = router;