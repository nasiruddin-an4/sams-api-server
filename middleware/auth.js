const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

// Protect routes — verify JWT token (BYPASSED FOR DEV)
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // If no token
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired', isExpired: true });
    }
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
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

// Block users who haven't changed their first-login password
// Exempt: password-change endpoints themselves
exports.requirePasswordChange = (req, res, next) => {
  if (req.user.isFirstLogin === true) {
    return res.status(403).json({
      success: false,
      code: 'CHANGE_PASSWORD',
      error: 'You must change your password before accessing this resource'
    });
  }
  next();
};

// Attach the linked Student document ID for data isolation
// Use after protect + authorize('student')
exports.attachStudentId = async (req, res, next) => {
  try {
    let studentId = req.user.linkedStudentId;

    // Fallback: look up by registrationNumber if linkedStudentId not set
    if (!studentId) {
      const student = await Student.findOne({
        $or: [
          { userId: req.user._id },
          { rollNumber: req.user.registrationNumber }
        ]
      });

      if (student) {
        studentId = student._id;
        // Auto-heal: set linkedStudentId on User for future lookups
        req.user.linkedStudentId = studentId;
        await User.findByIdAndUpdate(req.user._id, { linkedStudentId: studentId });
      }
    }

    if (!studentId) {
      return res.status(404).json({
        success: false,
        error: 'No linked student profile found for this account'
      });
    }

    req.studentId = studentId;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Error resolving student profile' });
  }
};

