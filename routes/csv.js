const express = require('express');
const router = express.Router();
const {
  uploadStudents,
  downloadTemplate,
  resendCredentials
} = require('../controllers/csvController');
const { protect, authorize } = require('../middleware/auth');
const { uploadCSV } = require('../middleware/upload');

// All routes protected and authorized
router.use(protect);

router.get('/template', authorize('admin', 'super_admin'), downloadTemplate);
router.post('/upload-students', authorize('admin', 'super_admin'), uploadCSV, uploadStudents);
router.post('/resend-credentials/:studentId', authorize('admin', 'super_admin', 'accountant'), resendCredentials);

module.exports = router;
