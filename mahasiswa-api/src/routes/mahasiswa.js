const express = require('express');
const router = express.Router();
const mahasiswaController = require('../controllers/mahasiswaController');

router.post('/', mahasiswaController.addMahasiswa);
router.get('/', mahasiswaController.getAllMahasiswa); // <-- Pastikan ini ada
router.get('/:id', mahasiswaController.getMahasiswaById); // <-- Pastikan ini ada
router.get('/nim/:nim', mahasiswaController.getMahasiswaByNim); // <-- Pastikan ini ada

module.exports = router;