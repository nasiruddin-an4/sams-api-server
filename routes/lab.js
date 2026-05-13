const express = require('express');
const {
  getLabSessions,
  getLabSession,
  createLabSession,
  updateLabSession,
  deleteLabSession,
  getLabMarks,
  getLabMarkById,
  createLabMark,
  bulkCreateLabMarks,
  updateLabMark,
  deleteLabMark,
  getLabMarksSummary
} = require('../controllers/labController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Lab Marks
router.get('/marks/summary/:sectionId', authorize('admin', 'teacher'), getLabMarksSummary);
router.post('/marks/bulk', authorize('admin', 'teacher'), bulkCreateLabMarks);

router.route('/marks')
  .get(authorize('admin', 'teacher', 'parent'), getLabMarks)
  .post(authorize('admin', 'teacher'), createLabMark);

router.route('/marks/:id')
  .get(authorize('admin', 'teacher', 'parent'), getLabMarkById)
  .put(authorize('admin', 'teacher'), updateLabMark)
  .delete(authorize('admin'), deleteLabMark);

// Lab Sessions
router.route('/sessions')
  .get(authorize('admin', 'teacher'), getLabSessions)
  .post(authorize('admin', 'teacher'), createLabSession);

router.route('/sessions/:id')
  .get(authorize('admin', 'teacher'), getLabSession)
  .put(authorize('admin', 'teacher'), updateLabSession)
  .delete(authorize('admin', 'teacher'), deleteLabSession);

module.exports = router;
