const express = require('express');
const {
  getSections,
  getSection,
  createSection,
  updateSection,
  deleteSection
} = require('../controllers/academicController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant'), getSections)
  .post(authorize('admin'), createSection);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant'), getSection)
  .put(authorize('admin'), updateSection)
  .delete(authorize('admin'), deleteSection);

module.exports = router;
