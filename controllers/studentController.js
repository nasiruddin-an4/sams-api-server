const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const ExamMark = require('../models/ExamMark');
const Fine = require('../models/Fine');
const Result = require('../models/Result');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get all students
// @route   GET /api/students
exports.getStudents = async (req, res) => {
  const { classId, batchId, sectionId, gender, isActive, search, semester, program, page = 1, limit = 20 } = req.query;
  const query = {};

  if (classId) query.class = classId;
  if (batchId) query.batch = batchId;
  if (sectionId) query.section = sectionId;
  if (gender) query.gender = gender;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (semester) query.semester = parseInt(semester);
  if (program) query.program = { $regex: program, $options: 'i' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
      { registrationNumber: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Teacher can only see assigned sections
  if (req.user.role === 'teacher') {
    query.section = { $in: req.user.assignedSections };
  }

  // Parent can only see own child
  if (req.user.role === 'parent') {
    query.parentUserId = req.user.id;
  }

  const total = await Student.countDocuments(query);
  const students = await Student.find(query)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('rollNumber');

  res.status(200).json({
    success: true,
    count: students.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: students
  });
};

// @desc    Get single student
// @route   GET /api/students/:id
exports.getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name teacher')
    .populate('parentUserId', 'name email phone');

  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Parent check
  if (req.user.role === 'parent' && student.parentUserId?.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }

  res.status(200).json({ success: true, data: student });
};

// @desc    Create student
// @route   POST /api/students
exports.createStudent = async (req, res) => {
  // Create user account for student if registration number provided
  let userId;
  if (req.body.registrationNumber) {
    const user = await User.create({
      name: req.body.name,
      registrationNumber: req.body.registrationNumber,
      password: req.body.registrationNumber, // Default password
      role: 'student',
      email: req.body.email || undefined,
      phone: req.body.phone
    });
    userId = user._id;
  }

  const studentData = { ...req.body };
  if (userId) studentData.userId = userId;

  const student = await Student.create(studentData);
  res.status(201).json({ success: true, data: student });
};

// @desc    Update student
// @route   PUT /api/students/:id
exports.updateStudent = async (req, res) => {
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
  res.status(200).json({ success: true, data: student });
};

// @desc    Delete student (soft)
// @route   DELETE /api/students/:id
exports.deleteStudent = async (req, res) => {
  const student = await Student.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
  res.status(200).json({ success: true, data: student, message: 'Student deactivated' });
};

// @desc    Bulk create students
// @route   POST /api/students/bulk
exports.bulkCreateStudents = async (req, res) => {
  const { students } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ success: false, error: 'Please provide an array of students' });
  }

  const results = [];
  const errors = [];

  // Process in batches of 100
  for (let i = 0; i < students.length; i += 100) {
    const batch = students.slice(i, i + 100);
    try {
      // Create user accounts for students with registration numbers
      const studentsWithUsers = await Promise.all(batch.map(async (student) => {
        if (student.registrationNumber) {
          try {
            const user = await User.create({
              name: student.name,
              registrationNumber: student.registrationNumber,
              password: student.registrationNumber,
              role: 'student',
              email: student.email || undefined,
              phone: student.phone
            });
            return { ...student, userId: user._id };
          } catch (userErr) {
            // Handle duplicate user registration if exists
            const existingUser = await User.findOne({ registrationNumber: student.registrationNumber });
            if (existingUser) return { ...student, userId: existingUser._id };
          }
        }
        return student;
      }));

      const created = await Student.insertMany(studentsWithUsers, { ordered: false });
      results.push(...created);
    } catch (err) {
      if (err.insertedDocs) results.push(...err.insertedDocs);
      errors.push(...(err.writeErrors || []).map(e => ({ index: i + e.index, error: e.errmsg })));
    }
  }

  res.status(201).json({
    success: true,
    inserted: results.length,
    errors: errors.length,
    errorDetails: errors,
    data: results
  });
};

// @desc    Get student attendance summary
// @route   GET /api/students/:id/attendance-summary
exports.getStudentAttendanceSummary = async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.id);

  const summary = await Attendance.aggregate([
    { $unwind: '$records' },
    { $match: { 'records.student': studentId } },
    {
      $group: {
        _id: '$records.status',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalDays = summary.reduce((acc, s) => acc + s.count, 0);
  const presentDays = summary.find(s => s._id === 'present')?.count || 0;
  const lateDays = summary.find(s => s._id === 'late')?.count || 0;
  const absentDays = summary.find(s => s._id === 'absent')?.count || 0;
  const leaveDays = summary.find(s => s._id === 'leave')?.count || 0;
  const percentage = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100 * 100) / 100 : 0;

  res.status(200).json({
    success: true,
    data: { totalDays, presentDays, lateDays, absentDays, leaveDays, percentage }
  });
};

// @desc    Get student academic summary (attendance + marks + fines + cgpa)
// @route   GET /api/students/:id/academic-summary
exports.getStudentAcademicSummary = async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.id);

  const student = await Student.findById(req.params.id)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name');

  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Attendance
  const attendanceSummary = await Attendance.aggregate([
    { $unwind: '$records' },
    { $match: { 'records.student': studentId } },
    { $group: { _id: '$records.status', count: { $sum: 1 } } }
  ]);

  const totalDays = attendanceSummary.reduce((acc, s) => acc + s.count, 0);
  const presentDays = (attendanceSummary.find(s => s._id === 'present')?.count || 0) +
                      (attendanceSummary.find(s => s._id === 'late')?.count || 0);
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100 * 100) / 100 : 0;

  // Exam Marks
  const examMarks = await ExamMark.find({ student: studentId })
    .populate('subject', 'name code')
    .sort('-examDate');

  // Fines
  const fines = await Fine.aggregate([
    { $match: { student: studentId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$paidAmount' }
      }
    }
  ]);

  // Results
  const results = await Result.find({ student: studentId }).sort('-semester');

  res.status(200).json({
    success: true,
    data: {
      student,
      attendance: { totalDays, presentDays, percentage: attendancePercentage },
      examMarks,
      fines,
      results,
      cgpa: student.cgpa
    }
  });
};

// @desc    Recalculate student CGPA
// @route   PUT /api/students/:id/update-cgpa
exports.updateStudentCGPA = async (req, res) => {
  const results = await Result.find({ student: req.params.id });

  if (results.length === 0) {
    return res.status(200).json({ success: true, data: { cgpa: 0 } });
  }

  let totalWeighted = 0;
  let totalCredits = 0;

  for (const result of results) {
    totalWeighted += result.sgpa * result.totalCredits;
    totalCredits += result.totalCredits;
  }

  const cgpa = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : 0;

  await Student.findByIdAndUpdate(req.params.id, { cgpa });

  res.status(200).json({ success: true, data: { cgpa, semestersCount: results.length } });
};
