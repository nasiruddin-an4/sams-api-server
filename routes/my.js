const express = require('express');
const {
  getMyDashboard,
  getMyAttendance,
  getMyAttendanceSummary,
  getMyMarks,
  getMyResults,
  getMyFines,
  getMyProfile,
  updateMyProfile
} = require('../controllers/myPortalController');
const { protect, authorize, attachStudentId } = require('../middleware/auth');

const router = express.Router();

// All routes are protected, for students only, and require the student ID attached
router.use(protect);
router.use(authorize('student'));
router.use(attachStudentId);

router.get('/dashboard', getMyDashboard);
router.get('/attendance', getMyAttendance);
router.get('/attendance/summary', getMyAttendanceSummary);
router.get('/marks', getMyMarks);
router.get('/results', getMyResults);
router.get('/fines', getMyFines);

router.route('/profile')
  .get(getMyProfile)
  .put(updateMyProfile);

module.exports = router;
