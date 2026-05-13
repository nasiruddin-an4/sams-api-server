const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fine = require('../models/Fine');
const Result = require('../models/Result');

// @desc    Get data updated since a given timestamp for offline sync
// @route   GET /api/sync
exports.getSyncData = async (req, res) => {
  const { lastSync } = req.query;
  
  if (!lastSync) {
    return res.status(400).json({ success: false, error: 'Please provide a lastSync ISO string timestamp' });
  }

  const syncDate = new Date(lastSync);

  // If user is a parent, only fetch their child's data
  // If user is a teacher, fetch data for their assigned sections
  let studentQuery = { updatedAt: { $gt: syncDate } };
  let attendanceQuery = { updatedAt: { $gt: syncDate } };
  let fineQuery = { updatedAt: { $gt: syncDate } };
  let resultQuery = { updatedAt: { $gt: syncDate } };

  if (req.user.role === 'parent') {
    const children = await Student.find({ parentUserId: req.user.id }).select('_id section');
    const childIds = children.map(c => c._id);
    const sectionIds = children.map(c => c.section);

    studentQuery.parentUserId = req.user.id;
    attendanceQuery['records.student'] = { $in: childIds };
    fineQuery.student = { $in: childIds };
    resultQuery.student = { $in: childIds };
  } else if (req.user.role === 'teacher') {
    studentQuery.section = { $in: req.user.assignedSections };
    attendanceQuery.section = { $in: req.user.assignedSections };
    fineQuery.section = { $in: req.user.assignedSections };
    resultQuery.section = { $in: req.user.assignedSections };
  }

  const students = await Student.find(studentQuery);
  const attendance = await Attendance.find(attendanceQuery);
  const fines = await Fine.find(fineQuery);
  const results = await Result.find(resultQuery);

  res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      students,
      attendance,
      fines,
      results
    }
  });
};
