const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.registerLecturer);
router.post('/login', authController.loginLecturer);

module.exports = router;