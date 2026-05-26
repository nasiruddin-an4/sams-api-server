const express = require('express');
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment
} = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'teacher', 'student', 'parent'), getAssignments)
  .post(authorize('admin', 'teacher'), createAssignment);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'student', 'parent'), getAssignment)
  .put(authorize('admin', 'teacher'), updateAssignment)
  .delete(authorize('admin', 'teacher'), deleteAssignment);

module.exports = router;
