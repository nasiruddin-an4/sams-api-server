const ExamMark = require('../models/ExamMark');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { enqueueNotification } = require('../services/queueService');

// @desc    Get exam marks
// @route   GET /api/exam-marks
exports.getExamMarks = async (req, res) => {
  const { classId, batchId, sectionId, subjectId, examType, academicYear, semester, studentId, page = 1, limit = 50 } = req.query;
  const query = {};

  if (classId) query.class = classId;
  if (batchId) query.batch = batchId;
  if (examType) query.examType = examType;
  if (academicYear) query.academicYear = academicYear;
  if (semester) query.semester = parseInt(semester);
  if (studentId) query.student = studentId;

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id });
    const assignedSectionIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    const uniqueSectionIds = [...new Set(assignedSectionIds)];
    const assignedSubjectIds = teacherAssignments.map(ta => ta.subject.toString());

    if (sectionId) {
      if (!uniqueSectionIds.includes(sectionId.toString())) {
        return res.status(403).json({ success: false, error: 'Not authorized for this section' });
      }
      query.section = sectionId;
    } else {
      query.section = { $in: uniqueSectionIds };
    }

    if (subjectId) {
      const Subject = require('../models/Subject');
      const subject = await Subject.findById(subjectId);
      const isAssignedSubject = assignedSubjectIds.includes(subjectId.toString()) || 
        (subject && subject.teacher && subject.teacher.toString() === req.user.id);
      
      if (!isAssignedSubject) {
        return res.status(403).json({ success: false, error: 'Not authorized for this subject' });
      }
      query.subject = subjectId;
    } else {
      const Subject = require('../models/Subject');
      const teacherSubjects = await Subject.find({ teacher: req.user.id }).select('_id');
      const allSubjectIds = [...new Set([...assignedSubjectIds, ...teacherSubjects.map(s => s._id.toString())])];
      query.subject = { $in: allSubjectIds };
    }
  } else {
    if (sectionId) query.section = sectionId;
    if (subjectId) query.subject = subjectId;
  }

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
  const { section, subject } = req.body;

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const hasAssignment = await SectionSubjectTeacher.findOne({
      section,
      subject,
      teacher: req.user.id
    });
    const Subject = require('../models/Subject');
    const subj = await Subject.findById(subject);
    const hasDirectSubject = subj && subj.teacher && subj.teacher.toString() === req.user.id;
    const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(section.toString());

    if (!hasAssignment && !(hasDirectSubject && isDirectSection)) {
      return res.status(403).json({ success: false, error: 'Not authorized to enter marks for this section and subject' });
    }
  }

  const Enrollment = require('../models/Enrollment');
  const activeEnrollment = await Enrollment.findOne({ student: req.body.student, section: req.body.section, status: 'active' });
  if (activeEnrollment) {
    req.body.enrollment = activeEnrollment._id;
  }
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
      const Subject = require('../models/Subject');
      const subj = await Subject.findById(firstMark.subject);
      const hasDirectSubject = subj && subj.teacher && subj.teacher.toString() === req.user.id;
      const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(firstMark.section.toString());

      if (!hasAssignment && !(hasDirectSubject && isDirectSection)) {
        return res.status(403).json({ success: false, error: 'Not authorized to enter marks for this section and subject' });
      }
    }
  }

  const Enrollment = require('../models/Enrollment');
  const studentIds = marks.map(m => m.student);
  const sectionIds = marks.map(m => m.section);
  const activeEnrollments = await Enrollment.find({ student: { $in: studentIds }, section: { $in: sectionIds }, status: 'active' });
  const enrollmentMap = {};
  activeEnrollments.forEach(e => {
    enrollmentMap[`${e.student}_${e.section}`] = e._id;
  });

  const marksWithUser = marks.map(m => ({ ...m, enteredBy: req.user.id, enrollment: enrollmentMap[`${m.student}_${m.section}`] || null }));
  const results = [];
  const errors = [];

  for (let i = 0; i < marksWithUser.length; i += 100) {
    const batch = marksWithUser.slice(i, i + 100);
    try {
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
    const Subject = require('../models/Subject');
    const subj = await Subject.findById(mark.subject);
    const hasDirectSubject = subj && subj.teacher && subj.teacher.toString() === req.user.id;
    const isDirectSection = req.user.assignedSections && req.user.assignedSections.map(id => id.toString()).includes(mark.section.toString());

    if (!hasAssignment && !(hasDirectSubject && isDirectSection)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this section and subject' });
    }
  }

  Object.assign(mark, req.body);
  await mark.save();

  await mark.populate([
    { path: 'student', select: 'name rollNumber' },
    { path: 'subject', select: 'name code' }
  ]);

  res.status(200).json({ success: true, data: mark });
};

// @desc    Delete exam mark
// @route   DELETE /api/exam-marks/:id
exports.deleteExamMark = async (req, res) => {
  const mark = await ExamMark.findById(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Exam mark not found' });
  await mark.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, message: 'Exam mark moved to trash' });
};

// @desc    Verify exam mark
// @route   PATCH /api/exam-marks/:id/verify
exports.verifyExamMark = async (req, res) => {
  const mark = await ExamMark.findById(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Exam mark not found' });

  // Cannot verify own marks
  if (mark.enteredBy && mark.enteredBy.toString() === req.user.id) {
    return res.status(403).json({ success: false, error: 'Not authorized: You cannot verify marks entered by yourself' });
  }

  mark.isVerified = true;
  mark.verifiedBy = req.user.id;
  await mark.save();

  await mark.populate([
    { path: 'student', select: 'name rollNumber' },
    { path: 'verifiedBy', select: 'name' }
  ]);

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
