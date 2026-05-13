const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerFcmToken
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/register-token', registerFcmToken);
router.patch('/read-all', markAllAsRead);

router.route('/')
  .get(getNotifications);

router.route('/:id/read')
  .patch(markAsRead);

module.exports = router;
