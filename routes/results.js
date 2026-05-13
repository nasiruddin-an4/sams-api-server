const express = require('express');
const {
  generateResult,
  getResults,
  getResultById,
  publishResult,
  updateResult,
  getResultSummary,
  getStudentTranscript
} = require('../controllers/resultController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/generate', authorize('admin'), generateResult);
router.get('/summary/:sectionId', authorize('admin', 'teacher'), getResultSummary);
router.get('/transcript/:studentId', authorize('admin', 'teacher', 'parent'), getStudentTranscript);

router.route('/')
  .get(authorize('admin', 'teacher', 'parent'), getResults);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'parent'), getResultById)
  .put(authorize('admin'), updateResult);

router.patch('/:id/publish', authorize('admin'), publishResult);

module.exports = router;
