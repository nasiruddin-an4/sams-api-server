const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  const { role, isActive, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
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

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.status(200).json({ success: true, data: user, message: 'User deactivated' });
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
