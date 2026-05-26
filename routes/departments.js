const express = require('express');
const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getDepartments)
  .post(protect, authorize('admin', 'super_admin'), createDepartment);

router
  .route('/:id')
  .get(protect, getDepartment)
  .put(protect, authorize('admin', 'super_admin'), updateDepartment)
  .delete(protect, authorize('admin', 'super_admin'), deleteDepartment);

module.exports = router;
