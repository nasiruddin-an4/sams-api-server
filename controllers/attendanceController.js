const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Section = require('../models/Section');
const mongoose = require('mongoose');
const { enqueueNotification } = require('../services/queueService');

// @desc    Mark attendance (upsert by date+section+subject)
// @route   POST /api/attendance/mark
exports.markAttendance = async (req, res) => {
  const { date, classId, batchId, sectionId, subjectId, records, isHoliday, notes } = req.body;

  const attendanceDate = new Date(date);
  attendanceDate.setUTCHours(0, 0, 0, 0);

  const filter = { date: attendanceDate, section: sectionId };
  if (subjectId) filter.subject = subjectId;

  let attendance = await Attendance.findOne(filter);

  if (attendance) {
    attendance.records = records;
    attendance.isHoliday = isHoliday || false;
    attendance.notes = notes;
    attendance.markedBy = req.user.id;
    await attendance.save();
  } else {
    attendance = await Attendance.create({
      date: attendanceDate,
      class: classId,
      batch: batchId,
      section: sectionId,
      subject: subjectId,
      markedBy: req.user.id,
      records,
      isHoliday: isHoliday || false,
      notes
    });
  }

  await attendance.populate([
    { path: 'records.student', select: 'name rollNumber' },
    { path: 'markedBy', select: 'name' }
  ]);

  // Get absent students to notify parents
  const absentStudentIds = records.filter(r => r.status === 'absent').map(r => r.student);
  if (absentStudentIds.length > 0) {
    const absentStudents = await Student.find({ _id: { $in: absentStudentIds } }).select('parentUserId name');
    const parentIds = absentStudents.map(s => s.parentUserId).filter(Boolean);
    
    // Asynchronously send notification
    if (parentIds.length > 0) {
      await enqueueNotification(
        parentIds,
        'Attendance Alert',
        `Your child was marked absent on ${attendanceDate.toDateString()}`,
        'attendance',
        attendance._id
      );
    }
  }

  res.status(200).json({ success: true, data: attendance });
};

// @desc    Get attendance records
// @route   GET /api/attendance
exports.getAttendance = async (req, res) => {
  const { sectionId, classId, batchId, date, from, to, subjectId, page = 1, limit = 20 } = req.query;
  const query = {};

  if (sectionId) query.section = sectionId;
  if (classId) query.class = classId;
  if (batchId) query.batch = batchId;
  if (subjectId) query.subject = subjectId;

  if (date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    query.date = d;
  } else if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  // Teacher: only assigned sections
  if (req.user.role === 'teacher') {
    query.section = { $in: req.user.assignedSections };
  }

  const total = await Attendance.countDocuments(query);
  const attendance = await Attendance.find(query)
    .populate('class', 'name')
    .populate('batch', 'name')
    .populate('section', 'name')
    .populate('subject', 'name code')
    .populate('markedBy', 'name')
    .populate('records.student', 'name rollNumber')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('-date');

  res.status(200).json({
    success: true, count: attendance.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: attendance
  });
};

// @desc    Get attendance by ID
// @route   GET /api/attendance/:id
exports.getAttendanceById = async (req, res) => {
  const attendance = await Attendance.findById(req.params.id)
    .populate('class', 'name')
    .populate('batch', 'name')
    .populate('section', 'name')
    .populate('subject', 'name code')
    .populate('markedBy', 'name')
    .populate('records.student', 'name rollNumber photo');

  if (!attendance) return res.status(404).json({ success: false, error: 'Attendance not found' });
  res.status(200).json({ success: true, data: attendance });
};

// @desc    Update single student status in attendance record
// @route   PATCH /api/attendance/:id/record/:studentId
exports.updateStudentStatus = async (req, res) => {
  const { status, remarks, checkInTime, checkOutTime } = req.body;

  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) return res.status(404).json({ success: false, error: 'Attendance not found' });

  const record = attendance.records.find(r => r.student.toString() === req.params.studentId);
  if (!record) return res.status(404).json({ success: false, error: 'Student record not found' });

  if (status) record.status = status;
  if (remarks !== undefined) record.remarks = remarks;
  if (checkInTime) record.checkInTime = checkInTime;
  if (checkOutTime) record.checkOutTime = checkOutTime;

  await attendance.save();
  await attendance.populate('records.student', 'name rollNumber');

  res.status(200).json({ success: true, data: attendance });
};

// @desc    Get today's attendance for a section
// @route   GET /api/attendance/today/:sectionId
exports.getTodayAttendance = async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({
    section: req.params.sectionId,
    date: today
  })
    .populate('records.student', 'name rollNumber photo')
    .populate('subject', 'name code')
    .populate('markedBy', 'name');

  // Get all students in section to find unmarked ones
  const allStudents = await Student.find({ section: req.params.sectionId, isActive: true })
    .select('name rollNumber photo');

  let unmarkedStudents = allStudents;
  if (attendance) {
    const markedIds = attendance.records.map(r => r.student._id.toString());
    unmarkedStudents = allStudents.filter(s => !markedIds.includes(s._id.toString()));
  }

  res.status(200).json({
    success: true,
    data: {
      attendance: attendance || null,
      unmarkedStudents,
      totalStudents: allStudents.length,
      markedCount: attendance ? attendance.records.length : 0
    }
  });
};

// @desc    Get section attendance summary (aggregate per student)
// @route   GET /api/attendance/summary/section/:sectionId
exports.getSectionAttendanceSummary = async (req, res) => {
  const { from, to, subjectId } = req.query;
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);

  const matchStage = { section: sectionId };
  if (subjectId) matchStage.subject = new mongoose.Types.ObjectId(subjectId);
  if (from || to) {
    matchStage.date = {};
    if (from) matchStage.date.$gte = new Date(from);
    if (to) matchStage.date.$lte = new Date(to);
  }

  const summary = await Attendance.aggregate([
    { $match: matchStage },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$records.student',
        totalDays: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$records.status', 'late'] }, 1, 0] } },
        leave: { $sum: { $cond: [{ $eq: ['$records.status', 'leave'] }, 1, 0] } }
      }
    },
    {
      $addFields: {
        percentage: {
          $round: [{ $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$totalDays'] }, 100] }, 2]
        }
      }
    },
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'student'
      }
    },
    { $unwind: '$student' },
    {
      $project: {
        _id: 1,
        studentName: '$student.name',
        rollNumber: '$student.rollNumber',
        totalDays: 1, present: 1, absent: 1, late: 1, leave: 1, percentage: 1
      }
    },
    { $sort: { rollNumber: 1 } }
  ]);

  res.status(200).json({ success: true, count: summary.length, data: summary });
};

// @desc    Delete attendance
// @route   DELETE /api/attendance/:id
exports.deleteAttendance = async (req, res) => {
  const attendance = await Attendance.findByIdAndDelete(req.params.id);
  if (!attendance) return res.status(404).json({ success: false, error: 'Attendance not found' });
  res.status(200).json({ success: true, data: {} });
};

// @desc    Bulk mark holiday
// @route   POST /api/attendance/bulk-holiday
exports.bulkMarkHoliday = async (req, res) => {
  const { startDate, endDate, notes } = req.body;

  const sections = await Section.find({ isActive: true });
  let created = 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateNormalized = new Date(d);
    dateNormalized.setUTCHours(0, 0, 0, 0);

    for (const section of sections) {
      const students = await Student.find({ section: section._id, isActive: true });
      const records = students.map(s => ({
        student: s._id,
        status: 'holiday',
        remarks: notes || 'Holiday'
      }));

      try {
        await Attendance.findOneAndUpdate(
          { date: dateNormalized, section: section._id },
          {
            date: dateNormalized,
            class: section.class,
            batch: section.batch,
            section: section._id,
            markedBy: req.user.id,
            records,
            isHoliday: true,
            notes: notes || 'Holiday'
          },
          { upsert: true, new: true }
        );
        created++;
      } catch (err) {
        // Skip duplicates
      }
    }
  }

  res.status(200).json({ success: true, message: `Holiday marked for ${created} section-days` });
};
