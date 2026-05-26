const Assignment = require('../models/Assignment');

// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private
exports.getAssignments = async (req, res) => {
  const filter = {};
  
  if (req.query.subjectId) filter.subject = req.query.subjectId;
  if (req.query.batchId) filter.batch = req.query.batchId;
  if (req.query.sectionId) filter.section = req.query.sectionId;
  if (req.query.status) filter.status = req.query.status;

  // Teachers can only see assignments for their assigned sections
  if (req.user.role === 'teacher') {
    filter.section = { $in: req.user.assignedSections };
  }

  const assignments = await Assignment.find(filter)
    .populate('subject', 'name code')
    .populate('batch', 'name year')
    .populate('section', 'name')
    .sort('-dueDate');

  res.status(200).json({
    success: true,
    count: assignments.length,
    data: assignments
  });
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private
exports.getAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('subject', 'name code')
    .populate('batch', 'name year')
    .populate('section', 'name');

  if (!assignment) {
    return res.status(404).json({
      success: false,
      error: 'Assignment not found'
    });
  }

  res.status(200).json({
    success: true,
    data: assignment
  });
};

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Admin, Teacher)
exports.createAssignment = async (req, res) => {
  req.body.createdBy = req.user.id;
  const assignment = await Assignment.create(req.body);

  res.status(201).json({
    success: true,
    data: assignment
  });
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private (Admin, Teacher)
exports.updateAssignment = async (req, res) => {
  let assignment = await Assignment.findById(req.params.id);

  if (!assignment) {
    return res.status(404).json({
      success: false,
      error: 'Assignment not found'
    });
  }

  // Check ownership / permission if teacher
  if (req.user.role === 'teacher' && assignment.createdBy.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to update this assignment'
    });
  }

  assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: assignment
  });
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Admin, Teacher)
exports.deleteAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);

  if (!assignment) {
    return res.status(404).json({
      success: false,
      error: 'Assignment not found'
    });
  }

  // Check ownership / permission if teacher
  if (req.user.role === 'teacher' && assignment.createdBy.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: 'Not authorized to delete this assignment'
    });
  }

  await assignment.softDelete(req.user.id, req.body.reason || 'Requested deletion');

  res.status(200).json({
    success: true,
    message: 'Assignment moved to trash'
  });
};
