const LabSession = require('../models/LabSession');
const LabMark = require('../models/LabMark');
const mongoose = require('mongoose');

// ==================== LAB SESSIONS ====================

exports.getLabSessions = async (req, res) => {
  const { subjectId, sectionId, from, to, page = 1, limit = 20 } = req.query;
  const query = {};
  if (subjectId) query.subject = subjectId;
  if (sectionId) query.section = sectionId;
  if (from || to) {
    query.sessionDate = {};
    if (from) query.sessionDate.$gte = new Date(from);
    if (to) query.sessionDate.$lte = new Date(to);
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
  res.status(200).json({ success: true, data: session });
};

exports.createLabSession = async (req, res) => {
  const session = await LabSession.create(req.body);
  res.status(201).json({ success: true, data: session });
};

exports.updateLabSession = async (req, res) => {
  const session = await LabSession.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!session) return res.status(404).json({ success: false, error: 'Lab session not found' });
  res.status(200).json({ success: true, data: session });
};

exports.deleteLabSession = async (req, res) => {
  const session = await LabSession.findByIdAndDelete(req.params.id);
  if (!session) return res.status(404).json({ success: false, error: 'Lab session not found' });
  // Also delete related lab marks
  await LabMark.deleteMany({ labSession: req.params.id });
  res.status(200).json({ success: true, data: {} });
};

// ==================== LAB MARKS ====================

exports.getLabMarks = async (req, res) => {
  const { sessionId, sectionId, studentId, page = 1, limit = 50 } = req.query;
  const query = {};
  if (sessionId) query.labSession = sessionId;
  if (sectionId) query.section = sectionId;
  if (studentId) query.student = studentId;

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
  req.body.enteredBy = req.user.id;
  const mark = await LabMark.create(req.body);
  res.status(201).json({ success: true, data: mark });
};

exports.bulkCreateLabMarks = async (req, res) => {
  const { marks } = req.body;
  if (!marks || !Array.isArray(marks)) {
    return res.status(400).json({ success: false, error: 'Please provide an array of marks' });
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
  const mark = await LabMark.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!mark) return res.status(404).json({ success: false, error: 'Lab mark not found' });
  res.status(200).json({ success: true, data: mark });
};

exports.deleteLabMark = async (req, res) => {
  const mark = await LabMark.findByIdAndDelete(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Lab mark not found' });
  res.status(200).json({ success: true, data: {} });
};

// @desc    Get lab marks summary per student
// @route   GET /api/lab/marks/summary/:sectionId
exports.getLabMarksSummary = async (req, res) => {
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const { subjectId } = req.query;

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
