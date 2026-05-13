const express = require('express');
const {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass
} = require('../controllers/academicController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant'), getClasses)
  .post(authorize('admin'), createClass);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant'), getClass)
  .put(authorize('admin'), updateClass)
  .delete(authorize('admin'), deleteClass);

module.exports = router;
