const express = require('express');
const {
  getTestSeries,
  getTestSeriesById,
  createTestSeries,
  updateTestSeries,
  deleteTestSeries,
  getClassTestMarks,
  getClassTestMarkById,
  createClassTestMark,
  bulkCreateClassTestMarks,
  updateClassTestMark,
  deleteClassTestMark,
  getClassTestSummary,
  getSectionTestReport
} = require('../controllers/classTestController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Class Test Marks
router.get('/summary/:sectionId', authorize('admin', 'teacher'), getClassTestSummary);
router.get('/section-report/:sectionId', authorize('admin', 'teacher'), getSectionTestReport);
router.post('/marks/bulk', authorize('admin', 'teacher'), bulkCreateClassTestMarks);

router.route('/marks')
  .get(authorize('admin', 'teacher', 'parent'), getClassTestMarks)
  .post(authorize('admin', 'teacher'), createClassTestMark);

router.route('/marks/:id')
  .get(authorize('admin', 'teacher', 'parent'), getClassTestMarkById)
  .put(authorize('admin', 'teacher'), updateClassTestMark)
  .delete(authorize('admin', 'teacher'), deleteClassTestMark);

// Test Series
router.route('/series')
  .get(authorize('admin', 'teacher'), getTestSeries)
  .post(authorize('admin', 'teacher'), createTestSeries);

router.route('/series/:id')
  .get(authorize('admin', 'teacher'), getTestSeriesById)
  .put(authorize('admin', 'teacher'), updateTestSeries)
  .delete(authorize('admin', 'teacher'), deleteTestSeries);

module.exports = router;
