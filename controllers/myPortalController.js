const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const ExamMark = require('../models/ExamMark');
const Fine = require('../models/Fine');
const Result = require('../models/Result');
const Section = require('../models/Section');
const ClassTest = require('../models/ClassTest');
const LabMark = require('../models/LabMark');

// @desc    Get Student Dashboard Overview
// @route   GET /api/my/dashboard
exports.getMyDashboard = async (req, res) => {
  const studentId = req.studentId;

  const student = await Student.findById(studentId)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name');

  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // 1. Attendance
  const attendanceSummary = await Attendance.aggregate([
    { $unwind: '$records' },
    { $match: { 'records.student': student._id } },
    { $group: { _id: '$records.status', count: { $sum: 1 } } }
  ]);

  const totalDays = attendanceSummary.reduce((acc, s) => acc + s.count, 0);
  const presentDays = (attendanceSummary.find(s => s._id === 'present')?.count || 0) +
                      (attendanceSummary.find(s => s._id === 'late')?.count || 0);
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100 * 100) / 100 : 0;

  // 2. Pending Fines Alert
  const fines = await Fine.aggregate([
    { $match: { student: student._id, status: { $in: ['pending', 'partial'] } } },
    { $group: { _id: null, count: { $sum: 1 }, totalOutstanding: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
  ]);
  const pendingFines = fines[0]?.count || 0;

  // 3. Recent Marks
  const recentMarks = await ExamMark.find({ student: student._id })
    .populate('subject', 'name')
    .sort('-createdAt')
    .limit(5);

  const formattedRecentMarks = recentMarks.map(m => ({
    subject: m.subject?.name,
    examType: m.examType,
    obtainedMarks: m.obtainedMarks,
    totalMarks: m.totalMarks,
    grade: m.grade
  }));

  // 4. Upcoming Classes (mocked based on section timetable if available)
  // For now returning empty array as timetable logic isn't fully implemented in the db model
  const classesToday = [];

  res.status(200).json({
    success: true,
    data: {
      studentName: student.name,
      batch: student.batch?.name,
      section: student.section?.name,
      currentSemester: student.semester,
      cgpa: student.cgpa,
      attendancePercentage,
      pendingFines,
      lowAttendanceAlert: attendancePercentage < 75 && totalDays > 10,
      recentMarks: formattedRecentMarks,
      classesToday
    }
  });
};

// @desc    Get My Attendance
// @route   GET /api/my/attendance
exports.getMyAttendance = async (req, res) => {
  const { semester } = req.query;
  const query = { 'records.student': req.studentId };
  if (semester) query.semester = parseInt(semester);

  const attendance = await Attendance.find(query)
    .populate('subject', 'name code')
    .sort('-date');

  const formattedAttendance = attendance.map(a => {
    const record = a.records.find(r => r.student.toString() === req.studentId.toString());
    return {
      date: a.date,
      subject: a.subject,
      status: record?.status,
      remarks: record?.remarks,
      type: a.type
    };
  });

  res.status(200).json({ success: true, data: formattedAttendance });
};

// @desc    Get My Attendance Summary
// @route   GET /api/my/attendance/summary
exports.getMyAttendanceSummary = async (req, res) => {
  const summary = await Attendance.aggregate([
    { $unwind: '$records' },
    { $match: { 'records.student': req.studentId } },
    {
      $group: {
        _id: '$subject',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$records.status', 'late'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] } },
        leave: { $sum: { $cond: [{ $eq: ['$records.status', 'leave'] }, 1, 0] } }
      }
    },
    { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subjectData' } },
    { $unwind: { path: '$subjectData', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        subject: '$subjectData.name',
        code: '$subjectData.code',
        total: 1,
        present: 1,
        late: 1,
        absent: 1,
        leave: 1,
        percentage: {
          $multiply: [
            { $divide: [{ $add: ['$present', '$late'] }, { $max: ['$total', 1] }] },
            100
          ]
        }
      }
    }
  ]);

  res.status(200).json({ success: true, data: summary });
};

// @desc    Get My Marks
// @route   GET /api/my/marks
exports.getMyMarks = async (req, res) => {
  const examMarks = await ExamMark.find({ student: req.studentId })
    .populate('subject', 'name code')
    .sort('-examDate');

  const classTestMarks = await ClassTest.find({ 'marks.student': req.studentId })
    .populate('subject', 'name code')
    .sort('-date');

  const labMarks = await LabMark.find({ student: req.studentId })
    .populate('subject', 'name code')
    .sort('-date');

  const formattedCTMarks = classTestMarks.map(ct => {
    const mark = ct.marks.find(m => m.student.toString() === req.studentId.toString());
    return {
      _id: ct._id,
      title: ct.title,
      subject: ct.subject,
      date: ct.date,
      totalMarks: ct.totalMarks,
      obtainedMarks: mark?.obtainedMarks,
      status: mark?.status,
      type: 'Class Test'
    };
  });

  res.status(200).json({
    success: true,
    data: {
      examMarks,
      classTestMarks: formattedCTMarks,
      labMarks
    }
  });
};

// @desc    Get My Results
// @route   GET /api/my/results
exports.getMyResults = async (req, res) => {
  const results = await Result.find({ student: req.studentId })
    .populate('semester')
    .sort('-semester');

  res.status(200).json({ success: true, data: results });
};

// @desc    Get My Fines
// @route   GET /api/my/fines
exports.getMyFines = async (req, res) => {
  const fines = await Fine.find({ student: req.studentId })
    .populate('fineType', 'name')
    .sort('-issuedDate');

  res.status(200).json({ success: true, data: fines });
};

// @desc    Get My Profile
// @route   GET /api/my/profile
exports.getMyProfile = async (req, res) => {
  const student = await Student.findById(req.studentId)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name');

  res.status(200).json({ success: true, data: student });
};

// @desc    Update My Profile (Limited fields)
// @route   PUT /api/my/profile
exports.updateMyProfile = async (req, res) => {
  const { phone, address } = req.body;
  
  const updateData = {};
  if (phone) updateData.phone = phone;
  if (address) updateData.address = address;

  const student = await Student.findByIdAndUpdate(req.studentId, updateData, {
    new: true,
    runValidators: true
  }).populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name');

  res.status(200).json({ success: true, data: student });
};
