const express = require('express');
const {
  getBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch
} = require('../controllers/academicController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('admin', 'teacher', 'accountant'), getBatches)
  .post(authorize('admin'), createBatch);

router.route('/:id')
  .get(authorize('admin', 'teacher', 'accountant'), getBatch)
  .put(authorize('admin'), updateBatch)
  .delete(authorize('admin'), deleteBatch);

module.exports = router;
