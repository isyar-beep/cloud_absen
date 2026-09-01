const express = require('express');
const router = express.Router();
const {
  listProjects, getProject, createProject, updateProject, deleteProject,
} = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');

// Membaca: admin dan konsultan. Lingkupnya dipersempit di dalam controller --
// konsultan hanya menerima proyek yang dipegangnya.
router.get('/', authenticate, authorize('admin', 'konsultan'), listProjects);
router.get('/:id', authenticate, authorize('admin', 'konsultan'), getProject);

// Menulis: admin saja. Dalam kontrak konsultansi, daftar proyek dan
// personelnya adalah bagian dari kontrak -- konsultan tidak boleh
// menambahkan atau mengubahnya sendiri.
router.post('/', authenticate, authorize('admin'), createProject);
router.put('/:id', authenticate, authorize('admin'), updateProject);
router.delete('/:id', authenticate, authorize('admin'), deleteProject);

module.exports = router;
