const express = require('express');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  changePasswordFirstTime,
  refreshToken,
  logout
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/register', protect, authorize('admin'), register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.put('/first-login-password', protect, changePasswordFirstTime);
router.post('/refresh-token', protect, refreshToken);

module.exports = router;
