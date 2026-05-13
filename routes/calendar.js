const express = require('express');
const {
  getCalendar,
  getCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} = require('../controllers/academicController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getCalendar)
  .post(authorize('admin'), createCalendarEvent);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getCalendarEvent)
  .put(authorize('admin'), updateCalendarEvent)
  .delete(authorize('admin'), deleteCalendarEvent);

module.exports = router;
