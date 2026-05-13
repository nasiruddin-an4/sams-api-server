const express = require('express');
const {
  markAttendance,
  getAttendance,
  getAttendanceById,
  updateStudentStatus,
  getTodayAttendance,
  getSectionAttendanceSummary,
  deleteAttendance,
  bulkMarkHoliday
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/mark', authorize('admin', 'teacher'), markAttendance);
router.post('/bulk-holiday', authorize('admin'), bulkMarkHoliday);

router.get('/today/:sectionId', authorize('admin', 'teacher'), getTodayAttendance);
router.get('/summary/section/:sectionId', authorize('admin', 'teacher'), getSectionAttendanceSummary);

router.route('/')
  .get(authorize('admin', 'teacher', 'parent'), getAttendance);

router.route('/:id')
  .get(authorize('admin', 'teacher'), getAttendanceById)
  .delete(authorize('admin'), deleteAttendance);

router.patch('/:id/record/:studentId', authorize('admin', 'teacher'), updateStudentStatus);

module.exports = router;
