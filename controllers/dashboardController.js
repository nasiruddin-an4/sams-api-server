const Student = require('../models/Student');
const Teacher = require('../models/User'); // Role: teacher
const Section = require('../models/Section');
const Attendance = require('../models/Attendance');
const Fine = require('../models/Fine');
const ExamMark = require('../models/ExamMark');
const Class = require('../models/Department');
const mongoose = require('mongoose');

// @desc    Get dashboard statistics overview
// @route   GET /api/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  // Teacher-specific stats
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id });
    const assignedSectionIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    const uniqueSectionIds = [...new Set(assignedSectionIds)].map(id => new mongoose.Types.ObjectId(id));

    const totalStudents = await Student.countDocuments({ section: { $in: uniqueSectionIds }, isActive: true });
    
    // Schedule
    const populatedAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id, isActive: true })
      .populate('section', 'name')
      .populate('subject', 'name code type');
    
    const schedule = populatedAssignments.map(a => ({
      section: a.section?.name,
      subject: a.subject?.name,
      code: a.subject?.code,
      type: a.subject?.type
    }));

    // Pending attendance count
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const markedToday = await Attendance.find({
      date: today,
      section: { $in: uniqueSectionIds }
    });
    
    let pendingAttendanceCount = 0;
    for (const assign of populatedAssignments) {
      const isMarked = markedToday.some(att => 
        att.section.toString() === assign.section?._id?.toString() && 
        att.subject?.toString() === assign.subject?._id?.toString()
      );
      if (!isMarked) {
        pendingAttendanceCount++;
      }
    }

    // Low attendance alerts count
    const lowAttendanceStudents = await Attendance.aggregate([
      { $match: { section: { $in: uniqueSectionIds } } },
      { $unwind: '$records' },
      {
        $group: {
          _id: '$records.student',
          totalDays: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0] } }
        }
      },
      {
        $project: {
          percentage: { $multiply: [{ $divide: ['$present', '$totalDays'] }, 100] }
        }
      },
      { $match: { percentage: { $lt: 75 } } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        isTeacher: true,
        totalStudents,
        pendingAttendanceCount,
        schedule,
        lowAttendanceCount: lowAttendanceStudents.length
      }
    });
  }

  const totalStudents = await Student.countDocuments({ isActive: true });
  const totalTeachers = await Teacher.countDocuments({ role: 'teacher', isActive: true });
  const totalClasses = await Class.countDocuments({ isActive: true });
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const todayAttendance = await Attendance.aggregate([
    { $match: { date: today } },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$records.status',
        count: { $sum: 1 }
      }
    }
  ]);

  const presentCount = todayAttendance.find(a => a._id === 'present' || a._id === 'late')?.count || 0;
  const absentCount = todayAttendance.find(a => a._id === 'absent')?.count || 0;

  const totalFinesAgg = await Fine.aggregate([
    { $match: { status: { $in: ['pending', 'partial'] } } },
    { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }
  ]);
  const outstandingFines = totalFinesAgg[0]?.total || 0;

  res.status(200).json({
    success: true,
    data: {
      totalStudents,
      totalTeachers,
      totalClasses,
      attendance: {
        present: presentCount,
        absent: absentCount,
        percentage: totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0
      },
      outstandingFines
    }
  });
};

// @desc    Get weekly attendance trend
// @route   GET /api/dashboard/weekly-trend
exports.getWeeklyTrend = async (req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const trend = await Attendance.aggregate([
    { $match: { date: { $gte: sevenDaysAgo } } },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$date',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const data = trend.map(t => ({
    date: t._id.toISOString().split('T')[0],
    percentage: t.total > 0 ? Math.round((t.present / t.total) * 100) : 0
  }));

  res.status(200).json({ success: true, data });
};

// @desc    Get class summary
exports.getClassSummary = async (req, res) => {
  const classes = await Class.find({ isActive: true });
  const summary = [];

  for (const cls of classes) {
    const students = await Student.countDocuments({ class: cls._id, isActive: true });
    const sections = await Section.countDocuments({ class: cls._id, isActive: true });
    summary.push({
      classId: cls._id,
      className: cls.name,
      totalStudents: students,
      totalSections: sections
    });
  }

  res.status(200).json({ success: true, data: summary });
};

exports.getPendingAttendance = async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const activeSections = await Section.find({ isActive: true }).select('_id name');
  const markedToday = await Attendance.find({ date: today }).distinct('section');

  const pending = activeSections.filter(sec => !markedToday.some(m => m.equals(sec._id)));

  res.status(200).json({ success: true, count: pending.length, data: pending });
};

exports.getTopAbsentees = async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const absentees = await Attendance.aggregate([
    { $match: { date: { $gte: startOfMonth } } },
    { $unwind: '$records' },
    { $match: { 'records.status': 'absent' } },
    { $group: { _id: '$records.student', absentDays: { $sum: 1 } } },
    { $sort: { absentDays: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $project: { name: '$student.name', rollNumber: '$student.rollNumber', absentDays: 1 } }
  ]);

  res.status(200).json({ success: true, data: absentees });
};

exports.getPendingFines = async (req, res) => {
  const fines = await Fine.aggregate([
    { $match: { status: { $in: ['pending', 'partial'] } } },
    { $group: { _id: '$student', outstanding: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } },
    { $sort: { outstanding: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $project: { name: '$student.name', rollNumber: '$student.rollNumber', outstanding: 1 } }
  ]);

  res.status(200).json({ success: true, data: fines });
};

exports.getRecentActivity = async (req, res) => {
  // Combine latest 5 from different collections
  const recentAttendance = await Attendance.find().sort('-createdAt').limit(5).populate('markedBy', 'name');
  const recentMarks = await ExamMark.find().sort('-createdAt').limit(5).populate('enteredBy', 'name').populate('subject', 'name');
  const recentFines = await Fine.find().sort('-createdAt').limit(5).populate('issuedBy', 'name').populate('student', 'name');

  const activity = [
    ...recentAttendance.map(a => ({ type: 'Attendance', date: a.createdAt, user: a.markedBy?.name, details: `Marked attendance for ${a.date.toISOString().split('T')[0]}` })),
    ...recentMarks.map(m => ({ type: 'Exam Mark', date: m.createdAt, user: m.enteredBy?.name, details: `Entered marks for ${m.subject?.name}` })),
    ...recentFines.map(f => ({ type: 'Fine', date: f.createdAt, user: f.issuedBy?.name, details: `Issued fine to ${f.student?.name}` }))
  ];

  activity.sort((a, b) => b.date - a.date);

  res.status(200).json({ success: true, data: activity.slice(0, 10) });
};

exports.getAcademicProgress = async (req, res) => {
  res.status(200).json({ success: true, data: { message: "Academic progress metrics here" } });
};
