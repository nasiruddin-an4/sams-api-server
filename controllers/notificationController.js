const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Get user notifications
// @route   GET /api/notifications
exports.getNotifications = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const total = await Notification.countDocuments({ recipient: req.user.id });
  const notifications = await Notification.find({ recipient: req.user.id })
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: notifications
  });
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user.id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ success: false, error: 'Notification not found' });
  }

  res.status(200).json({ success: true, data: notification });
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user.id, isRead: false },
    { isRead: true }
  );

  res.status(200).json({ success: true, data: {} });
};

// @desc    Register FCM Token
// @route   POST /api/notifications/register-token
exports.registerFcmToken = async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) {
    return res.status(400).json({ success: false, error: 'Please provide an FCM token' });
  }

  // Ensure token isn't already in array
  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { fcmTokens: fcmToken }
  });

  res.status(200).json({ success: true, message: 'FCM Token registered successfully' });
};
