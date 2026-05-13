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
  updateStudentCGPA
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/bulk', authorize('admin'), bulkCreateStudents);

router.get('/:id/attendance-summary', authorize('admin', 'teacher', 'parent'), getStudentAttendanceSummary);
router.get('/:id/academic-summary', authorize('admin', 'teacher', 'parent'), getStudentAcademicSummary);
router.put('/:id/update-cgpa', authorize('admin'), updateStudentCGPA);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getStudents)
  .post(authorize('admin'), createStudent);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getStudent)
  .put(authorize('admin'), updateStudent)
  .delete(authorize('admin'), deleteStudent);

module.exports = router;
