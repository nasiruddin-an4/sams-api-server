const Department = require('../models/Department');
const Section = require('../models/Section');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  // Teachers can only see departments that contain their assigned sections
  if (req.user.role === 'teacher') {
    const sections = await Section.find({ _id: { $in: req.user.assignedSections } }).select('department');
    const deptIds = [...new Set(sections.map(s => s.department.toString()))];
    filter._id = { $in: deptIds };
  }

  const departments = await Department.find(filter)
    .populate('head', 'name email')
    .sort('name');
    
  res.status(200).json({ success: true, count: departments.length, data: departments });
};

// @desc    Get single department
// @route   GET /api/departments/:id
// @access  Private
exports.getDepartment = async (req, res) => {
  const department = await Department.findById(req.params.id)
    .populate('head', 'name email')
    .populate('programs');
    
  if (!department) {
    return res.status(404).json({ success: false, error: 'Department not found' });
  }
  
  res.status(200).json({ success: true, data: department });
};

// @desc    Create department
// @route   POST /api/departments
// @access  Private/Admin
exports.createDepartment = async (req, res) => {
  req.body.createdBy = req.user.id;
  const department = await Department.create(req.body);
  res.status(201).json({ success: true, data: department });
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private/Admin
exports.updateDepartment = async (req, res) => {
  const department = await Department.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    { new: true, runValidators: true }
  );
  
  if (!department) {
    return res.status(404).json({ success: false, error: 'Department not found' });
  }
  
  res.status(200).json({ success: true, data: department });
};

// @desc    Delete department (Deactivate)
// @route   DELETE /api/departments/:id
// @access  Private/Admin
exports.deleteDepartment = async (req, res) => {
  const department = await Department.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  
  if (!department) {
    return res.status(404).json({ success: false, error: 'Department not found' });
  }
  
  res.status(200).json({ success: true, data: department, message: 'Department deactivated successfully' });
};
