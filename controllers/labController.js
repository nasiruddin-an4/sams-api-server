const LabSession = require('../models/LabSession');
const LabMark = require('../models/LabMark');
const mongoose = require('mongoose');

// ==================== LAB SESSIONS ====================

exports.getLabSessions = async (req, res) => {
  const { subjectId, sectionId, from, to, page = 1, limit = 20 } = req.query;
  const query = {};
  if (subjectId) query.subject = subjectId;
  if (from || to) {
    query.sessionDate = {};
    if (from) query.sessionDate.$gte = new Date(from);
    if (to) query.sessionDate.$lte = new Date(to);
  }

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id });
    const assignedSectionIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    const uniqueSectionIds = [...new Set(assignedSectionIds)];

    if (sectionId) {
      if (!uniqueSectionIds.includes(sectionId.toString())) {
        return res.status(403).json({ success: false, error: 'Not authorized for this section' });
      }
      query.section = sectionId;
    } else {
      query.section = { $in: uniqueSectionIds };
    }
  } else if (sectionId) {
    query.section = sectionId;
  }

  const total = await LabSession.countDocuments(query);
  const sessions = await LabSession.find(query)
    .populate('subject', 'name code')
    .populate('section', 'name')
    .populate('teacher', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('-sessionDate');

  res.status(200).json({
    success: true, count: sessions.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: sessions
  });
};

exports.getLabSession = async (req, res) => {
  const session = await LabSession.findById(req.params.id)
    .populate('subject', 'name code')
    .populate('section', 'name')
    .populate('teacher', 'name');
  if (!session) return res.status(404).json({ success: false, error: 'Lab session not found' });

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    if (!assignedIds.includes(session.section?._id?.toString() || session.section?.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this lab session' });
    }
  }

  res.status(200).json({ success: true, data: session });
};

exports.createLabSession = async (req, res) => {
  const { section, subject } = req.body;

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const hasAssignment = await SectionSubjectTeacher.findOne({
      section,
      subject,
      teacher: req.user.id
    });
    const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(section.toString());

    if (!hasAssignment && !isDirectSection) {
      return res.status(403).json({ success: false, error: 'Not authorized to create a lab session for this section and subject' });
    }
  }

  const session = await LabSession.create(req.body);
  res.status(201).json({ success: true, data: session });
};

exports.updateLabSession = async (req, res) => {
  const session = await LabSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, error: 'Lab session not found' });

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const hasAssignment = await SectionSubjectTeacher.findOne({
      section: session.section,
      subject: session.subject,
      teacher: req.user.id
    });
    const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(session.section.toString());

    if (!hasAssignment && !isDirectSection) {
      return res.status(403).json({ success: false, error: 'Not authorized for this section' });
    }
  }

  Object.assign(session, req.body);
  await session.save();
  res.status(200).json({ success: true, data: session });
};

exports.deleteLabSession = async (req, res) => {
  const session = await LabSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, error: 'Lab session not found' });
  
  // Also soft delete related lab marks
  const marks = await LabMark.find({ labSession: req.params.id });
  for (const mark of marks) {
    await mark.softDelete(req.user.id, 'Parent lab session deleted');
  }

  await session.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, message: 'Lab session and marks moved to trash' });
};

// ==================== LAB MARKS ====================

exports.getLabMarks = async (req, res) => {
  const { sessionId, sectionId, studentId, page = 1, limit = 50 } = req.query;
  const query = {};
  if (sessionId) query.labSession = sessionId;
  if (studentId) query.student = studentId;

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    const uniqueSectionIds = [...new Set(assignedIds)];

    if (sectionId) {
      if (!uniqueSectionIds.includes(sectionId.toString())) {
        return res.status(403).json({ success: false, error: 'Not authorized for this section' });
      }
      query.section = sectionId;
    } else {
      query.section = { $in: uniqueSectionIds };
    }
  } else if (sectionId) {
    query.section = sectionId;
  }

  const total = await LabMark.countDocuments(query);
  const marks = await LabMark.find(query)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('labSession', 'experimentTitle experimentNumber sessionDate')
    .populate('enteredBy', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('student');

  res.status(200).json({
    success: true, count: marks.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: marks
  });
};

exports.getLabMarkById = async (req, res) => {
  const mark = await LabMark.findById(req.params.id)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('labSession', 'experimentTitle experimentNumber sessionDate')
    .populate('enteredBy', 'name');
  if (!mark) return res.status(404).json({ success: false, error: 'Lab mark not found' });
  res.status(200).json({ success: true, data: mark });
};

exports.createLabMark = async (req, res) => {
  const { section, subject } = req.body;

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const hasAssignment = await SectionSubjectTeacher.findOne({
      section,
      subject,
      teacher: req.user.id
    });
    const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(section.toString());

    if (!hasAssignment && !isDirectSection) {
      return res.status(403).json({ success: false, error: 'Not authorized to enter lab marks for this section' });
    }
  }

  req.body.enteredBy = req.user.id;
  const mark = await LabMark.create(req.body);
  res.status(201).json({ success: true, data: mark });
};

exports.bulkCreateLabMarks = async (req, res) => {
  const { marks } = req.body;
  if (!marks || !Array.isArray(marks)) {
    return res.status(400).json({ success: false, error: 'Please provide an array of marks' });
  }

  // Teacher check
  if (req.user.role === 'teacher') {
    const firstMark = marks[0];
    if (firstMark) {
      const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
      const hasAssignment = await SectionSubjectTeacher.findOne({
        section: firstMark.section,
        subject: firstMark.subject,
        teacher: req.user.id
      });
      const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(firstMark.section.toString());

      if (!hasAssignment && !isDirectSection) {
        return res.status(403).json({ success: false, error: 'Not authorized to enter lab marks for this section' });
      }
    }
  }

  const marksWithUser = marks.map(m => ({ ...m, enteredBy: req.user.id }));
  const results = [];
  const errors = [];

  for (let i = 0; i < marksWithUser.length; i += 100) {
    const batch = marksWithUser.slice(i, i + 100);
    try {
      const created = await LabMark.insertMany(batch, { ordered: false });
      results.push(...created);
    } catch (err) {
      if (err.insertedDocs) results.push(...err.insertedDocs);
      errors.push({ batch: Math.floor(i / 100), error: err.message });
    }
  }

  res.status(201).json({
    success: true, inserted: results.length, errors: errors.length,
    errorDetails: errors, data: results
  });
};

exports.updateLabMark = async (req, res) => {
  const mark = await LabMark.findById(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Lab mark not found' });

  // Teacher check
  if (req.user.role === 'teacher') {
    if (mark.enteredBy && mark.enteredBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to edit marks entered by another teacher' });
    }
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const hasAssignment = await SectionSubjectTeacher.findOne({
      section: mark.section,
      subject: mark.subject,
      teacher: req.user.id
    });
    const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(mark.section.toString());

    if (!hasAssignment && !isDirectSection) {
      return res.status(403).json({ success: false, error: 'Not authorized for this section' });
    }
  }

  Object.assign(mark, req.body);
  await mark.save();
  res.status(200).json({ success: true, data: mark });
};

exports.deleteLabMark = async (req, res) => {
  const mark = await LabMark.findById(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Lab mark not found' });
  await mark.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, message: 'Lab mark moved to trash' });
};

// @desc    Get lab marks summary per student
// @route   GET /api/lab/marks/summary/:sectionId
exports.getLabMarksSummary = async (req, res) => {
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const { subjectId } = req.query;

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    if (!assignedIds.includes(req.params.sectionId.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized for this section' });
    }
  }

  const matchStage = { section: sectionId };
  if (subjectId) matchStage.subject = new mongoose.Types.ObjectId(subjectId);

  const summary = await LabMark.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$student',
        totalSessions: { $sum: 1 },
        attended: { $sum: { $cond: [{ $ne: ['$attendanceStatus', 'absent'] }, 1, 0] } },
        avgObtainedMarks: { $avg: '$obtainedMarks' },
        avgPracticalPerformance: { $avg: '$practicalPerformance' },
        totalObtained: { $sum: '$obtainedMarks' },
        totalPossible: { $sum: '$totalMarks' }
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
        studentName: '$student.name',
        rollNumber: '$student.rollNumber',
        totalSessions: 1,
        attended: 1,
        avgObtainedMarks: { $round: ['$avgObtainedMarks', 2] },
        avgPracticalPerformance: { $round: ['$avgPracticalPerformance', 2] },
        overallPercentage: {
          $round: [{ $multiply: [{ $divide: ['$totalObtained', '$totalPossible'] }, 100] }, 2]
        }
      }
    },
    { $sort: { rollNumber: 1 } }
  ]);

  res.status(200).json({ success: true, count: summary.length, data: summary });
};
