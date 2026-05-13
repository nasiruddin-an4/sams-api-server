const express = require('express');
const {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject
} = require('../controllers/academicController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getSubjects)
  .post(authorize('admin'), createSubject);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant', 'parent'), getSubject)
  .put(authorize('admin'), updateSubject)
  .delete(authorize('admin'), deleteSubject);

module.exports = router;
