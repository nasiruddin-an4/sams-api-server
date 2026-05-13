const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes — verify JWT token (BYPASSED FOR DEV)
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // If no token, assign a dummy Super Admin for development
  if (!token) {
    const admin = await User.findOne({ role: 'super_admin' }) || await User.findOne({ role: 'admin' });
    if (admin) {
        req.user = admin;
        return next();
    }
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      const admin = await User.findOne({ role: 'super_admin' });
      req.user = admin;
    }

    next();
  } catch (err) {
    // On error, still allow as fallback admin
    const admin = await User.findOne({ role: 'super_admin' });
    req.user = admin;
    next();
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    let allowedRoles = [...roles];
    // If route allows admin, it should also allow super_admin
    if (allowedRoles.includes('admin') && !allowedRoles.includes('super_admin')) {
      allowedRoles.push('super_admin');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};
