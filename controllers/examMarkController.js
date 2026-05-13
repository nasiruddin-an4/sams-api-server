const ExamMark = require('../models/ExamMark');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { enqueueNotification } = require('../services/queueService');

// @desc    Get exam marks
// @route   GET /api/exam-marks
exports.getExamMarks = async (req, res) => {
  const { classId, sectionId, subjectId, examType, academicYear, semester, studentId, page = 1, limit = 50 } = req.query;
  const query = {};

  if (classId) query.class = classId;
  if (sectionId) query.section = sectionId;
  if (subjectId) query.subject = subjectId;
  if (examType) query.examType = examType;
  if (academicYear) query.academicYear = academicYear;
  if (semester) query.semester = parseInt(semester);
  if (studentId) query.student = studentId;

  const total = await ExamMark.countDocuments(query);
  const marks = await ExamMark.find(query)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('section', 'name')
    .populate('enteredBy', 'name')
    .populate('verifiedBy', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('student');

  res.status(200).json({
    success: true, count: marks.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: marks
  });
};

// @desc    Get exam mark by ID
// @route   GET /api/exam-marks/:id
exports.getExamMarkById = async (req, res) => {
  const mark = await ExamMark.findById(req.params.id)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('section', 'name')
    .populate('enteredBy', 'name')
    .populate('verifiedBy', 'name');

  if (!mark) return res.status(404).json({ success: false, error: 'Exam mark not found' });
  res.status(200).json({ success: true, data: mark });
};

// @desc    Create exam mark (single)
// @route   POST /api/exam-marks
exports.createExamMark = async (req, res) => {
  req.body.enteredBy = req.user.id;
  const mark = await ExamMark.create(req.body);
  await mark.populate([
    { path: 'student', select: 'name rollNumber' },
    { path: 'subject', select: 'name code' }
  ]);
  res.status(201).json({ success: true, data: mark });
};

// @desc    Bulk create exam marks
// @route   POST /api/exam-marks/bulk
exports.bulkCreateExamMarks = async (req, res) => {
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
      // Use create to trigger pre-save hooks for grade calculation
      const created = await ExamMark.create(batch);
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

// @desc    Update exam mark
// @route   PUT /api/exam-marks/:id
exports.updateExamMark = async (req, res) => {
  let mark = await ExamMark.findById(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Exam mark not found' });

  Object.assign(mark, req.body);
  await mark.save(); // triggers pre-save grade calculation

  await mark.populate([
    { path: 'student', select: 'name rollNumber' },
    { path: 'subject', select: 'name code' }
  ]);

  res.status(200).json({ success: true, data: mark });
};

// @desc    Delete exam mark
// @route   DELETE /api/exam-marks/:id
exports.deleteExamMark = async (req, res) => {
  const mark = await ExamMark.findByIdAndDelete(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Exam mark not found' });
  res.status(200).json({ success: true, data: {} });
};

// @desc    Verify exam mark
// @route   PATCH /api/exam-marks/:id/verify
exports.verifyExamMark = async (req, res) => {
  const mark = await ExamMark.findByIdAndUpdate(
    req.params.id,
    { isVerified: true, verifiedBy: req.user.id },
    { new: true }
  ).populate('student', 'name rollNumber')
   .populate('verifiedBy', 'name');

  if (!mark) return res.status(404).json({ success: false, error: 'Exam mark not found' });

  // Send notification to parent/student that marks are verified
  if (mark.student) {
    const studentInfo = await Student.findById(mark.student._id).select('parentUserId');
    if (studentInfo && studentInfo.parentUserId) {
      await enqueueNotification(
        [studentInfo.parentUserId],
        'Exam Marks Published',
        `Marks for ${mark.subject?.name || 'a subject'} have been verified and published.`,
        'exam',
        mark._id
      );
    }
  }

  res.status(200).json({ success: true, data: mark });
};

// @desc    Get section exam summary (aggregate)
// @route   GET /api/exam-marks/section-summary
exports.getSectionExamSummary = async (req, res) => {
  const { sectionId, subjectId, examType, academicYear, semester } = req.query;

  const matchStage = {};
  if (sectionId) matchStage.section = new mongoose.Types.ObjectId(sectionId);
  if (subjectId) matchStage.subject = new mongoose.Types.ObjectId(subjectId);
  if (examType) matchStage.examType = examType;
  if (academicYear) matchStage.academicYear = academicYear;
  if (semester) matchStage.semester = parseInt(semester);

  const summary = await ExamMark.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$subject',
        totalStudents: { $sum: 1 },
        avgMarks: { $avg: '$obtainedMarks' },
        highestMarks: { $max: '$obtainedMarks' },
        lowestMarks: { $min: '$obtainedMarks' },
        avgPercentage: { $avg: { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] } },
        passed: { $sum: { $cond: ['$isPassed', 1, 0] } },
        failed: { $sum: { $cond: ['$isPassed', 0, 1] } },
        grades: { $push: '$grade' }
      }
    },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subject'
      }
    },
    { $unwind: '$subject' },
    {
      $project: {
        subjectName: '$subject.name',
        subjectCode: '$subject.code',
        totalStudents: 1,
        avgMarks: { $round: ['$avgMarks', 2] },
        highestMarks: 1,
        lowestMarks: 1,
        avgPercentage: { $round: ['$avgPercentage', 2] },
        passPercentage: { $round: [{ $multiply: [{ $divide: ['$passed', '$totalStudents'] }, 100] }, 2] },
        passed: 1,
        failed: 1,
        gradeDistribution: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: '$grades' },
              as: 'g',
              in: {
                k: '$$g',
                v: { $size: { $filter: { input: '$grades', as: 'gr', cond: { $eq: ['$$gr', '$$g'] } } } }
              }
            }
          }
        }
      }
    }
  ]);

  res.status(200).json({ success: true, count: summary.length, data: summary });
};

// @desc    Get student exam history
// @route   GET /api/exam-marks/student/:studentId/history
exports.getStudentExamHistory = async (req, res) => {
  const marks = await ExamMark.find({ student: req.params.studentId })
    .populate('subject', 'name code creditHours')
    .populate('section', 'name')
    .sort({ academicYear: -1, semester: -1, examType: 1 });

  // Group by semester
  const grouped = {};
  for (const mark of marks) {
    const key = `${mark.academicYear}-S${mark.semester}`;
    if (!grouped[key]) grouped[key] = { academicYear: mark.academicYear, semester: mark.semester, marks: [] };
    grouped[key].marks.push(mark);
  }

  res.status(200).json({
    success: true,
    count: marks.length,
    data: Object.values(grouped)
  });
};
