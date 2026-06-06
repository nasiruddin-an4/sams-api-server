const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkCreateStudents,
  getStudentAttendanceSummary,
  getStudentAcademicSummary,
  getStudentAcademicHistory,
  updateStudentCGPA,
  getBatchOverview,
  moveSection,
  changeStatus,
  bulkMove,
  bulkChangeStatus,
  graduateBatch
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/bulk', authorize('admin'), bulkCreateStudents);

// Static paths before dynamic :id paths
router.get('/batch-overview', authorize('admin', 'teacher'), getBatchOverview);
router.patch('/bulk-move', authorize('admin'), bulkMove);
router.patch('/bulk-status', authorize('admin'), bulkChangeStatus);
router.patch('/graduate-batch', authorize('admin'), graduateBatch);

router.get('/:id/attendance-summary', authorize('admin', 'teacher', 'parent'), getStudentAttendanceSummary);
router.get('/:id/academic-summary', authorize('admin', 'teacher', 'parent'), getStudentAcademicSummary);
router.get('/:id/academic-history', authorize('admin', 'teacher', 'parent'), getStudentAcademicHistory);
router.put('/:id/update-cgpa', authorize('admin'), updateStudentCGPA);

router.patch('/:id/move-section', authorize('admin'), moveSection);
router.patch('/:id/status', authorize('admin'), changeStatus);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getStudents)
  .post(authorize('admin'), createStudent);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getStudent)
  .put(authorize('admin'), updateStudent)
  .delete(authorize('admin'), deleteStudent);

module.exports = router;
