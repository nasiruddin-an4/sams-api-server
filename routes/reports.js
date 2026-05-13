const express = require('express');
const {
  classWiseAttendanceReport,
  batchWiseAttendanceReport,
  sectionWiseAttendanceReport,
  studentWiseReport,
  dateWiseReport,
  monthlyAttendanceReport,
  lowAttendanceReport,
  sectionRecordReport,
  exportStudentFinePDF,
  exportSectionFinePDF,
  exportSectionRecordPDF,
  exportExcel,
  exportMarksExcel,
  exportResultExcel
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Attendance Reports
router.get('/attendance/class/:classId', authorize('admin', 'teacher'), classWiseAttendanceReport);
router.get('/attendance/batch/:batchId', authorize('admin', 'teacher'), batchWiseAttendanceReport);
router.get('/attendance/section/:sectionId', authorize('admin', 'teacher'), sectionWiseAttendanceReport);
router.get('/attendance/date', authorize('admin', 'teacher'), dateWiseReport);
router.get('/attendance/monthly', authorize('admin', 'teacher'), monthlyAttendanceReport);
router.get('/attendance/low', authorize('admin', 'teacher'), lowAttendanceReport);

// Comprehensive Reports
router.get('/student/:studentId', authorize('admin', 'teacher', 'parent'), studentWiseReport);
router.get('/section-record/:sectionId', authorize('admin', 'teacher'), sectionRecordReport);

// Exports - PDF
router.get('/export/pdf/fine/student/:studentId', authorize('admin', 'accountant', 'parent'), exportStudentFinePDF);
router.get('/export/pdf/fine/section/:sectionId', authorize('admin', 'accountant'), exportSectionFinePDF);
router.get('/export/pdf/record/section/:sectionId', authorize('admin', 'teacher'), exportSectionRecordPDF);

// Exports - Excel
router.get('/export/excel/attendance/:sectionId', authorize('admin', 'teacher'), exportExcel);
router.get('/export/excel/marks/:sectionId/:subjectId', authorize('admin', 'teacher'), exportMarksExcel);
router.get('/export/excel/results/:sectionId', authorize('admin', 'teacher'), exportResultExcel);

module.exports = router;
