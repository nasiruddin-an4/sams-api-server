const express = require('express');
const {
  getDashboardStats,
  getWeeklyTrend,
  getClassSummary,
  getPendingAttendance,
  getTopAbsentees,
  getPendingFines,
  getRecentActivity,
  getAcademicProgress
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'teacher', 'accountant'));

router.get('/stats', getDashboardStats);
router.get('/weekly-trend', getWeeklyTrend);
router.get('/classes-summary', getClassSummary);
router.get('/pending-attendance', authorize('admin'), getPendingAttendance);
router.get('/top-absentees', getTopAbsentees);
router.get('/pending-fines', authorize('admin', 'accountant'), getPendingFines);
router.get('/recent-activity', authorize('admin'), getRecentActivity);
router.get('/academic-progress', getAcademicProgress);

module.exports = router;
