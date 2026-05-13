const express = require('express');
const {
  getFineTypes,
  getFineType,
  createFineType,
  updateFineType,
  deleteFineType,
  getFines,
  getFineById,
  issueFine,
  bulkIssueFine,
  updateFine,
  payFine,
  waiveFine,
  deleteFine,
  getStudentFinesSummary,
  getSectionFinesList,
  autoApplyRecurringFines
} = require('../controllers/fineController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Fine Types
router.route('/types')
  .get(authorize('admin', 'accountant'), getFineTypes)
  .post(authorize('admin', 'accountant'), createFineType);

router.route('/types/:id')
  .get(authorize('admin', 'accountant'), getFineType)
  .put(authorize('admin', 'accountant'), updateFineType)
  .delete(authorize('admin', 'accountant'), deleteFineType);

// Fines
router.post('/bulk', authorize('admin', 'accountant'), bulkIssueFine);
router.post('/auto-apply', authorize('admin', 'accountant'), autoApplyRecurringFines);

router.get('/student/:studentId/summary', authorize('admin', 'accountant', 'parent'), getStudentFinesSummary);
router.get('/section/:sectionId', authorize('admin', 'accountant'), getSectionFinesList);

router.route('/')
  .get(authorize('admin', 'accountant', 'parent'), getFines)
  .post(authorize('admin', 'accountant'), issueFine);

router.route('/:id')
  .get(authorize('admin', 'accountant', 'parent'), getFineById)
  .put(authorize('admin', 'accountant'), updateFine)
  .delete(authorize('admin', 'accountant'), deleteFine);

router.patch('/:id/pay', authorize('admin', 'accountant'), payFine);
router.patch('/:id/waive', authorize('admin', 'accountant'), waiveFine);

module.exports = router;
