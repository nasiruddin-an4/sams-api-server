const User = require('../models/User');
const { sendTeacherWelcomeEmail } = require('../config/email');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  const { role, isActive, search, department, employmentType, employmentStatus, page = 1, limit = 20 } = req.query;
  const query = {};

  if (role) {
    if (role === 'super_admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    query.role = role;
  } else {
    query.role = { $ne: 'super_admin' };
  }

  if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';
  if (department) query.department = department;
  if (employmentType) query.employmentType = employmentType;
  if (employmentStatus) query.employmentStatus = employmentStatus;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .populate('assignedClasses', 'name')
    .populate('assignedSections', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: users
  });
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('assignedClasses', 'name')
    .populate('assignedSections', 'name batch class');

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.status(200).json({ success: true, data: user });
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  // Role-based restrictions
  if (req.user.role === 'admin') {
    if (['super_admin', 'admin'].includes(req.body.role)) {
      return res.status(403).json({ success: false, error: 'Admin cannot create super_admin or admin accounts' });
    }
  }

  const user = await User.create(req.body);

  if (user.role === 'teacher' && user.email) {
    // Send welcome email in background with plain text password from req.body
    sendTeacherWelcomeEmail({
      name: user.name,
      email: user.email,
      password: req.body.password
    }).then(async (result) => {
      if (result && result.sent) {
        await User.findByIdAndUpdate(user._id, { 
          emailSent: true,
          welcomeEmailSentAt: new Date()
        });
      }
    }).catch((err) => {
      console.error('Welcome email error:', err);
    });
  }

  res.status(201).json({ success: true, data: user });
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  // Don't allow password update through this route
  delete req.body.password;

  // Role-based restrictions
  if (req.user.role === 'admin') {
    if (['super_admin', 'admin'].includes(req.body.role)) {
      return res.status(403).json({ success: false, error: 'Admin cannot promote to super_admin or admin' });
    }
    
    // Check target user's role
    const targetUser = await User.findById(req.params.id);
    if (targetUser && ['super_admin', 'admin'].includes(targetUser.role)) {
       return res.status(403).json({ success: false, error: 'Admin cannot modify super_admin or admin accounts' });
    }
  }

  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.status(200).json({ success: true, data: user });
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  if (req.user.role === 'admin') {
    const targetUser = await User.findById(req.params.id);
    if (targetUser && ['super_admin', 'admin'].includes(targetUser.role)) {
       return res.status(403).json({ success: false, error: 'Admin cannot delete super_admin or admin accounts' });
    }
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  user.isActive = false;
  await user.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');

  res.status(200).json({ success: true, data: user, message: 'User deactivated and moved to trash' });
};

// @desc    Get teachers list
// @route   GET /api/users/teachers
// @access  Private/Admin
exports.getTeachers = async (req, res) => {
  const teachers = await User.find({ role: 'teacher', isActive: true })
    .populate('assignedClasses', 'name')
    .populate('assignedSections', 'name batch class')
    .sort('name');

  res.status(200).json({ success: true, count: teachers.length, data: teachers });
};
