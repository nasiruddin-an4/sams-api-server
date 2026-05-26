const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Fine = require('../models/Fine');
const Student = require('../models/Student');
const Result = require('../models/Result');
const Section = require('../models/Section');
const { createPDF, addHeader, addTable, addFooter, addWatermark, addSignatureBlock } = require('../utils/pdfBuilder');
const { createWorkbook, addStyledHeader, colorCodeCell, autoFitColumns, addTitleRow, addDataRows } = require('../utils/excelBuilder');

// Teacher report validation helper
const validateTeacherReportAccess = async (req, res) => {
  if (req.user.role !== 'teacher') return true;

  const sectionId = req.params.sectionId || req.query.sectionId || req.query.section || req.body.sectionId || req.body.section || req.query.section_id || req.body.section_id;

  if (!sectionId) {
    res.status(403).json({ success: false, error: 'Please specify a section ID to view reports' });
    return false;
  }

  const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
  const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
  const assignedIds = [
    ...(req.user.assignedSections || []).map(id => id.toString()),
    ...teacherAssignments.map(ta => ta.section.toString())
  ];

  if (!assignedIds.includes(sectionId.toString())) {
    res.status(403).json({ success: false, error: 'Not authorized: You do not have access to this section\'s reports' });
    return false;
  }
  return true;
};

// Helper to get basic attendance aggregate
const getAttendanceAggregate = (matchStage) => [
  { $match: matchStage },
  { $unwind: '$records' },
  {
    $group: {
      _id: '$records.student',
      totalDays: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
      late: { $sum: { $cond: [{ $eq: ['$records.status', 'late'] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] } }
    }
  },
  {
    $addFields: {
      presentTotal: { $add: ['$present', '$late'] },
      percentage: { $round: [{ $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$totalDays'] }, 100] }, 2] }
    }
  },
  {
    $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' }
  },
  { $unwind: '$student' }
];

// @desc    Class-wise attendance report
exports.classWiseAttendanceReport = async (req, res) => {
  if (req.user.role === 'teacher') {
    return res.status(403).json({ success: false, error: 'Not authorized: Teachers cannot view class-wise reports' });
  }
  const classId = new mongoose.Types.ObjectId(req.params.classId);
  const matchStage = { class: classId };
  if (req.query.from && req.query.to) {
    matchStage.date = { $gte: new Date(req.query.from), $lte: new Date(req.query.to) };
  }

  const report = await Attendance.aggregate([
    { $match: matchStage },
    { $unwind: '$records' },
    {
      $group: {
        _id: { section: '$section', status: '$records.status' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.section',
        statuses: { $push: { k: '$_id.status', v: '$count' } },
        total: { $sum: '$count' }
      }
    },
    { $addFields: { statuses: { $arrayToObject: '$statuses' } } },
    {
      $lookup: { from: 'sections', localField: '_id', foreignField: '_id', as: 'section' }
    },
    { $unwind: '$section' },
    {
      $project: {
        sectionName: '$section.name',
        total: 1,
        present: { $ifNull: ['$statuses.present', 0] },
        late: { $ifNull: ['$statuses.late', 0] },
        absent: { $ifNull: ['$statuses.absent', 0] },
        leave: { $ifNull: ['$statuses.leave', 0] }
      }
    },
    {
      $addFields: {
        percentage: { $round: [{ $multiply: [{ $divide: [{ $add: ['$present', '$late'] }, '$total'] }, 100] }, 2] }
      }
    },
    { $sort: { sectionName: 1 } }
  ]);

  res.status(200).json({ success: true, data: report });
};

// @desc    Batch-wise attendance report
exports.batchWiseAttendanceReport = async (req, res) => {
  if (req.user.role === 'teacher') {
    return res.status(403).json({ success: false, error: 'Not authorized: Teachers cannot view batch-wise reports' });
  }
  const batchId = new mongoose.Types.ObjectId(req.params.batchId);
  const matchStage = { batch: batchId };
  
  const report = await Attendance.aggregate(getAttendanceAggregate(matchStage));
  res.status(200).json({ success: true, count: report.length, data: report });
};

// @desc    Section-wise attendance report
exports.sectionWiseAttendanceReport = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const matchStage = { section: sectionId };
  if (req.query.from && req.query.to) {
    matchStage.date = { $gte: new Date(req.query.from), $lte: new Date(req.query.to) };
  }

  const attendance = await Attendance.aggregate([
    ...getAttendanceAggregate(matchStage),
    {
      $project: {
        studentId: '$_id',
        name: '$student.name',
        rollNumber: '$student.rollNumber',
        totalDays: 1, present: '$presentTotal', absent: 1, percentage: 1
      }
    },
    { $sort: { rollNumber: 1 } }
  ]);

  // If fines requested, aggregate and merge
  if (req.query.includeFines === 'true') {
    const fines = await Fine.aggregate([
      { $match: { section: sectionId } },
      {
        $group: {
          _id: '$student',
          totalFine: { $sum: '$amount' },
          totalPaid: { $sum: '$paidAmount' }
        }
      }
    ]);

    const fineMap = {};
    fines.forEach(f => fineMap[f._id.toString()] = f);

    attendance.forEach(a => {
      const f = fineMap[a.studentId.toString()];
      a.totalFine = f ? f.totalFine : 0;
      a.totalPaid = f ? f.totalPaid : 0;
      a.outstandingFine = a.totalFine - a.totalPaid;
    });
  }

  res.status(200).json({ success: true, count: attendance.length, data: attendance });
};

// @desc    Student-wise report
exports.studentWiseReport = async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.studentId);
  const student = await Student.findById(studentId);
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    if (!assignedIds.includes(student.section.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized: Student is not in your assigned sections' });
    }
  }

  const attendance = await Attendance.aggregate(getAttendanceAggregate({ 'records.student': studentId }));
  
  const fines = await Fine.aggregate([
    { $match: { student: studentId } },
    { $group: { _id: null, total: { $sum: '$amount' }, paid: { $sum: '$paidAmount' } } }
  ]);

  const results = await Result.find({ student: studentId }).sort('-semester').limit(1);

  res.status(200).json({
    success: true,
    data: {
      attendance: attendance[0] || {},
      fines: fines[0] || { total: 0, paid: 0 },
      latestResult: results[0] || null
    }
  });
};

// @desc    Date-wise report
exports.dateWiseReport = async (req, res) => {
  const date = new Date(req.query.date || new Date());
  date.setUTCHours(0, 0, 0, 0);

  const report = await Attendance.aggregate([
    { $match: { date } },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$section',
        totalStudents: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] } }
      }
    },
    { $lookup: { from: 'sections', localField: '_id', foreignField: '_id', as: 'section' } },
    { $unwind: '$section' },
    {
      $project: {
        sectionName: '$section.name',
        totalStudents: 1, present: 1, absent: 1,
        percentage: { $round: [{ $multiply: [{ $divide: ['$present', '$totalStudents'] }, 100] }, 2] }
      }
    }
  ]);

  // Teacher check: filter results
  let filteredReport = report;
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    filteredReport = report.filter(r => assignedIds.includes(r._id.toString()));
  }

  res.status(200).json({ success: true, date, data: filteredReport });
};

// @desc    Monthly attendance report
exports.monthlyAttendanceReport = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const year = parseInt(req.query.year || new Date().getFullYear());
  const month = parseInt(req.query.month || new Date().getMonth() + 1);
  const sectionId = new mongoose.Types.ObjectId(req.query.sectionId);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const report = await Attendance.aggregate(getAttendanceAggregate({
    section: sectionId,
    date: { $gte: startDate, $lte: endDate }
  }));

  res.status(200).json({ success: true, count: report.length, data: report });
};

// @desc    Low attendance report
exports.lowAttendanceReport = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const threshold = parseFloat(req.query.threshold || 75);
  const sectionId = new mongoose.Types.ObjectId(req.query.sectionId);

  const report = await Attendance.aggregate([
    ...getAttendanceAggregate({ section: sectionId }),
    { $match: { percentage: { $lt: threshold } } },
    {
      $project: {
        name: '$student.name', rollNumber: '$student.rollNumber', phone: '$student.phone',
        totalDays: 1, present: '$presentTotal', percentage: 1
      }
    },
    { $sort: { percentage: 1 } }
  ]);

  res.status(200).json({ success: true, count: report.length, data: report });
};

// @desc    Section Record Report (FULL COMPREHENSIVE AGGREGATION)
exports.sectionRecordReport = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const { semester } = req.query;

  const matchStage = { section: sectionId };
  if (semester) matchStage.semester = parseInt(semester);

  // Get all students
  const students = await Student.find({ section: sectionId, isActive: true })
    .select('name rollNumber cgpa')
    .sort('rollNumber')
    .lean();

  const sIds = students.map(s => s._id);

  // 1. Attendance Aggregate
  const attendanceAgg = await Attendance.aggregate([
    { $match: { section: sectionId } },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$records.student',
        totalDays: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0] } }
      }
    }
  ]);
  const attMap = {};
  attendanceAgg.forEach(a => {
    attMap[a._id.toString()] = {
      total: a.totalDays,
      present: a.presentCount,
      percentage: a.totalDays > 0 ? Math.round((a.presentCount / a.totalDays) * 100) : 0
    };
  });

  // 2. Exam Marks Aggregate
  const examAgg = await Result.find({ section: sectionId }).select('student sgpa totalCredits isPassed').lean();
  const examMap = {};
  examAgg.forEach(e => examMap[e.student.toString()] = e);

  // 3. Fines Aggregate
  const finesAgg = await Fine.aggregate([
    { $match: { section: sectionId } },
    {
      $group: {
        _id: '$student',
        totalAmount: { $sum: '$amount' },
        paidAmount: { $sum: '$paidAmount' }
      }
    }
  ]);
  const fineMap = {};
  finesAgg.forEach(f => fineMap[f._id.toString()] = { total: f.totalAmount, outstanding: f.totalAmount - f.paidAmount });

  // Combine
  const combined = students.map(s => {
    const sid = s._id.toString();
    const att = attMap[sid] || { percentage: 0 };
    const res = examMap[sid] || { sgpa: 0, isPassed: false };
    const fin = fineMap[sid] || { total: 0, outstanding: 0 };

    return {
      studentId: s._id,
      name: s.name,
      rollNumber: s.rollNumber,
      attendancePercentage: att.percentage,
      sgpa: res.sgpa,
      cgpa: s.cgpa,
      isPassed: res.isPassed,
      totalFines: fin.total,
      outstandingFines: fin.outstanding
    };
  });

  res.status(200).json({ success: true, count: combined.length, data: combined });
};

// ==================== EXPORTS (PDF & EXCEL) ====================

// PDF: Student Fine
exports.exportStudentFinePDF = async (req, res) => {
  const student = await Student.findById(req.params.studentId);
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    if (!assignedIds.includes(student.section.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized to view student fines' });
    }
  }

  const fines = await Fine.find({ student: req.params.studentId }).populate('fineType', 'name');

  const doc = createPDF();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Fines_${student.rollNumber}.pdf`);
  doc.pipe(res);

  addHeader(doc, 'DIIT University', 'Student Fine Report');
  doc.fontSize(12).text(`Name: ${student.name} | Roll: ${student.rollNumber}`);
  doc.moveDown(2);

  const headers = ['Date', 'Fine Type', 'Amount', 'Paid', 'Status'];
  const rows = fines.map(f => [
    f.issuedDate.toLocaleDateString(),
    f.fineType.name,
    f.amount,
    f.paidAmount,
    f.status.toUpperCase()
  ]);

  addTable(doc, headers, rows);
  addWatermark(doc);
  addFooter(doc);
  addSignatureBlock(doc, [{ title: 'Accountant' }, { title: 'Head of Department' }]);

  doc.end();
};

// PDF: Section Fine List
exports.exportSectionFinePDF = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const section = await Section.findById(sectionId).populate('class');
  
  const fines = await Fine.aggregate([
    { $match: { section: sectionId } },
    { $group: { _id: '$student', total: { $sum: '$amount' }, paid: { $sum: '$paidAmount' } } },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $sort: { 'student.rollNumber': 1 } }
  ]);

  const doc = createPDF();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Section_Fines_${section.name}.pdf`);
  doc.pipe(res);

  addHeader(doc, 'DIIT University', `Fine Report - ${section.class.name} (${section.name})`);
  doc.moveDown(2);

  const headers = ['Roll', 'Name', 'Total Fine', 'Paid', 'Outstanding'];
  const rows = fines.map(f => [
    f.student.rollNumber,
    f.student.name,
    f.total,
    f.paid,
    f.total - f.paid
  ]);

  addTable(doc, headers, rows, { colWidths: [60, 150, 80, 80, 80] });
  addWatermark(doc);
  addFooter(doc);
  doc.end();
};

// PDF: Full Section Academic Record
exports.exportSectionRecordPDF = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const section = await Section.findById(req.params.sectionId).populate('class');
  const doc = createPDF({ layout: 'landscape' });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Academic_Record_${section.name}.pdf`);
  doc.pipe(res);

  addHeader(doc, 'DIIT University', `Comprehensive Academic Record - ${section.class.name} (${section.name})`);
  
  const results = await Result.find({ section: req.params.sectionId }).populate('student', 'name rollNumber cgpa').sort('student.rollNumber');
  
  const headers = ['Roll Number', 'Student Name', 'SGPA', 'CGPA', 'Status'];
  const rows = results.map(r => [
    r.student.rollNumber,
    r.student.name,
    r.sgpa,
    r.student.cgpa,
    r.isPassed ? 'PASSED' : 'FAILED'
  ]);

  addTable(doc, headers, rows);
  addWatermark(doc);
  addFooter(doc);
  addSignatureBlock(doc, [{ title: 'Class Teacher' }, { title: 'Head of Department' }]);

  doc.end();
};

// Excel: General Attendance
exports.exportExcel = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const section = await Section.findById(sectionId).populate('class');

  const attendanceAgg = await Attendance.aggregate([
    { $match: { section: sectionId } },
    { $unwind: '$records' },
    {
      $group: {
        _id: '$records.student',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$records.status', ['present', 'late']] }, 1, 0] } }
      }
    },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $sort: { 'student.rollNumber': 1 } }
  ]);

  const workbook = createWorkbook();
  const sheet = workbook.addWorksheet('Attendance');

  addTitleRow(sheet, `Attendance Report - ${section.class.name} (${section.name})`, 5);
  addStyledHeader(sheet, ['Roll Number', 'Student Name', 'Total Classes', 'Attended', 'Percentage']);

  attendanceAgg.forEach(a => {
    const percent = a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
    const row = sheet.addRow([a.student.rollNumber, a.student.name, a.total, a.present, `${percent}%`]);
    colorCodeCell(row.getCell(5), percent);
  });

  autoFitColumns(sheet);
  freezeTopRow(sheet);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Attendance_${section.name}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

// Excel: Marks
exports.exportMarksExcel = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const { sectionId, subjectId } = req.params;
  const marks = await ExamMark.find({ section: sectionId, subject: subjectId })
    .populate('student', 'name rollNumber')
    .populate('subject', 'name')
    .sort('student.rollNumber');

  if (marks.length === 0) return res.status(404).json({ success: false, error: 'No marks found' });

  const workbook = createWorkbook();
  const sheet = workbook.addWorksheet('Marks');

  addTitleRow(sheet, `Marks Sheet - ${marks[0].subject.name}`, 6);
  addStyledHeader(sheet, ['Roll', 'Name', 'Total Marks', 'Obtained', 'Grade', 'Status']);

  marks.forEach(m => {
    const percent = (m.obtainedMarks / m.totalMarks) * 100;
    const row = sheet.addRow([m.student.rollNumber, m.student.name, m.totalMarks, m.obtainedMarks, m.grade, m.isPassed ? 'Pass' : 'Fail']);
    colorCodeCell(row.getCell(4), percent);
  });

  autoFitColumns(sheet);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Marks.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

// Excel: Results
exports.exportResultExcel = async (req, res) => {
  if (!(await validateTeacherReportAccess(req, res))) return;
  const results = await Result.find({ section: req.params.sectionId })
    .populate('student', 'name rollNumber cgpa')
    .sort('rank');

  const workbook = createWorkbook();
  const sheet = workbook.addWorksheet('Results');

  addTitleRow(sheet, 'Section Results', 6);
  addStyledHeader(sheet, ['Rank', 'Roll', 'Name', 'SGPA', 'CGPA', 'Status']);

  results.forEach(r => {
    sheet.addRow([r.rank, r.student.rollNumber, r.student.name, r.sgpa, r.student.cgpa, r.isPassed ? 'Passed' : 'Failed']);
  });

  autoFitColumns(sheet);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Results.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};
