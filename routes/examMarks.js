const express = require('express');
const {
  getExamMarks,
  getExamMarkById,
  createExamMark,
  bulkCreateExamMarks,
  updateExamMark,
  deleteExamMark,
  verifyExamMark,
  getSectionExamSummary,
  getStudentExamHistory
} = require('../controllers/examMarkController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/bulk', authorize('admin', 'teacher'), bulkCreateExamMarks);
router.get('/section-summary', authorize('admin', 'teacher'), getSectionExamSummary);
router.get('/student/:studentId/history', authorize('admin', 'teacher', 'parent'), getStudentExamHistory);

router.route('/')
  .get(authorize('admin', 'teacher', 'parent'), getExamMarks)
  .post(authorize('admin', 'teacher'), createExamMark);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'parent'), getExamMarkById)
  .put(authorize('admin', 'teacher'), updateExamMark)
  .delete(authorize('admin'), deleteExamMark);

router.patch('/:id/verify', authorize('admin'), verifyExamMark);

module.exports = router;
