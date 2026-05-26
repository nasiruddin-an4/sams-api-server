const express = require('express');
const { getTrash, restoreItem, permanentDeleteItem, emptyTrash } = require('../controllers/trashController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('super_admin', 'admin'));

router.get('/', getTrash);
router.delete('/empty', emptyTrash);
router.patch('/:model/:id/restore', restoreItem);
router.delete('/:model/:id', permanentDeleteItem);

module.exports = router;
