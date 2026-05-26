const Result = require('../models/Result');
const ExamMark = require('../models/ExamMark');
const LabMark = require('../models/LabMark');
const ClassTest = require('../models/ClassTest');
const TestSeries = require('../models/TestSeries');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Section = require('../models/Section');
const { calculateGrade } = require('../utils/gradeCalculator');
const { calculateSGPA, calculateCGPA } = require('../utils/cgpaCalculator');
const mongoose = require('mongoose');
const { enqueueNotification } = require('../services/queueService');

// @desc    Generate result for a section+semester
// @route   POST /api/results/generate
exports.generateResult = async (req, res) => {
  const { sectionId, academicYear, semester } = req.body;

  const section = await Section.findById(sectionId).populate('class');
  if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

  const students = await Student.find({ section: sectionId, isActive: true });
  const subjects = await Subject.find({ class: section.class._id, isActive: true });

  const results = [];

  for (const student of students) {
    const subjectResults = [];

    for (const subject of subjects) {
      // Get exam marks (midterm + final)
      const examMarks = await ExamMark.find({
        student: student._id,
        subject: subject._id,
        semester: parseInt(semester)
      });

      let theoryMarks = 0;
      let theoryTotal = 0;
      for (const em of examMarks) {
        theoryMarks += em.obtainedMarks;
        theoryTotal += em.totalMarks;
      }

      // Get lab marks
      const labMarks = await LabMark.find({
        student: student._id,
        subject: subject._id,
        section: sectionId
      });

      let labObtained = 0;
      let labTotal = 0;
      for (const lm of labMarks) {
        labObtained += lm.obtainedMarks;
        labTotal += lm.totalMarks;
      }

      // Get class test marks with best-of-N
      const testSeriesList = await TestSeries.find({
        subject: subject._id,
        section: sectionId,
        semester: parseInt(semester)
      });

      let classTestAvg = 0;
      if (testSeriesList.length > 0) {
        const ctMarks = await ClassTest.find({
          student: student._id,
          subject: subject._id,
          section: sectionId,
          testSeries: { $in: testSeriesList.map(ts => ts._id) }
        });

        if (ctMarks.length > 0) {
          const percentages = ctMarks
            .filter(ct => !ct.isAbsent)
            .map(ct => (ct.obtainedMarks / ct.totalMarks) * 100);

          const isBestOfN = testSeriesList[0]?.isBestOfN;
          const nCount = testSeriesList[0]?.nCount || percentages.length;

          if (isBestOfN && nCount > 0 && nCount < percentages.length) {
            percentages.sort((a, b) => b - a);
            const bestN = percentages.slice(0, nCount);
            classTestAvg = bestN.reduce((s, p) => s + p, 0) / bestN.length;
          } else {
            classTestAvg = percentages.reduce((s, p) => s + p, 0) / percentages.length;
          }
        }
      }

      const totalObtained = theoryMarks + labObtained;
      const totalPossible = theoryTotal + labTotal;
      const gradeResult = calculateGrade(totalObtained, totalPossible || 1);

      subjectResults.push({
        subjectId: subject._id,
        theoryMarks,
        labMarks: labObtained,
        classTestAvg: Math.round(classTestAvg * 100) / 100,
        totalObtained,
        totalPossible,
        grade: gradeResult.grade,
        gradePoints: gradeResult.gradePoints,
        creditHours: subject.creditHours,
        status: gradeResult.status
      });
    }

    // Calculate SGPA
    const sgpaResult = calculateSGPA(subjectResults);

    // Get all previous results for CGPA
    const prevResults = await Result.find({
      student: student._id,
      semester: { $ne: parseInt(semester) }
    });

    const allSemesters = [
      ...prevResults.map(r => ({ sgpa: r.sgpa, totalCredits: r.totalCredits, earnedCredits: r.earnedCredits })),
      sgpaResult
    ];

    const cgpaResult = calculateCGPA(allSemesters);

    // Count section size for rank
    const sectionSize = students.length;

    const resultData = {
      student: student._id,
      academicYear,
      semester: parseInt(semester),
      section: sectionId,
      subjects: subjectResults,
      sgpa: sgpaResult.sgpa,
      cgpa: cgpaResult.cgpa,
      totalCredits: sgpaResult.totalCredits,
      earnedCredits: sgpaResult.earnedCredits,
      sectionSize,
      isPassed: subjectResults.every(s => s.status === 'Passed'),
      generatedBy: req.user.id
    };

    // Upsert result
    const result = await Result.findOneAndUpdate(
      { student: student._id, academicYear, semester: parseInt(semester) },
      resultData,
      { upsert: true, new: true, runValidators: true }
    );

    results.push(result);

    // Update student CGPA
    await Student.findByIdAndUpdate(student._id, { cgpa: cgpaResult.cgpa });
  }

  // Assign ranks based on SGPA
  results.sort((a, b) => b.sgpa - a.sgpa);
  for (let i = 0; i < results.length; i++) {
    results[i].rank = i + 1;
    await results[i].save();
  }

  res.status(200).json({
    success: true,
    message: `Results generated for ${results.length} students`,
    count: results.length,
    data: results
  });
};

// @desc    Get results
// @route   GET /api/results
exports.getResults = async (req, res) => {
  const { sectionId, academicYear, semester, studentId, page = 1, limit = 50 } = req.query;
  const query = {};

  if (sectionId) query.section = sectionId;
  if (academicYear) query.academicYear = academicYear;
  if (semester) query.semester = parseInt(semester);
  if (studentId) query.student = studentId;

  // Parent: own child only
  if (req.user.role === 'parent') {
    const children = await Student.find({ parentUserId: req.user.id }).select('_id');
    query.student = { $in: children.map(c => c._id) };
  }

  // Teacher: only their assigned sections
  if (req.user.role === 'teacher') {
    query.section = { $in: req.user.assignedSections };
  }

  const total = await Result.countDocuments(query);
  const results = await Result.find(query)
    .populate('student', 'name rollNumber registrationNumber program')
    .populate('section', 'name')
    .populate('subjects.subjectId', 'name code creditHours')
    .populate('generatedBy', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('rank');

  res.status(200).json({
    success: true, count: results.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: results
  });
};

// @desc    Get result by ID
exports.getResultById = async (req, res) => {
  const result = await Result.findById(req.params.id)
    .populate('student', 'name rollNumber registrationNumber program email')
    .populate('section', 'name')
    .populate('subjects.subjectId', 'name code creditHours type')
    .populate('generatedBy', 'name');

  if (!result) return res.status(404).json({ success: false, error: 'Result not found' });
  res.status(200).json({ success: true, data: result });
};

// @desc    Publish result
// @route   PATCH /api/results/:id/publish
exports.publishResult = async (req, res) => {
  const result = await Result.findByIdAndUpdate(
    req.params.id,
    { isPublished: true, publishedAt: new Date() },
    { new: true }
  ).populate('student', 'parentUserId');
  
  if (!result) return res.status(404).json({ success: false, error: 'Result not found' });

  // Send Notification
  if (result.student && result.student.parentUserId) {
    await enqueueNotification(
      [result.student.parentUserId],
      'Semester Results Published!',
      `The results for Semester ${result.semester} have been published. SGPA: ${result.sgpa}`,
      'exam',
      result._id
    );
  }

  res.status(200).json({ success: true, data: result });
};

// @desc    Update result (manual adjustment)
exports.updateResult = async (req, res) => {
  const result = await Result.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!result) return res.status(404).json({ success: false, error: 'Result not found' });
  res.status(200).json({ success: true, data: result });
};

// @desc    Get result summary for section
// @route   GET /api/results/summary/:sectionId
exports.getResultSummary = async (req, res) => {
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const { academicYear, semester } = req.query;

  const matchStage = { section: sectionId };
  if (academicYear) matchStage.academicYear = academicYear;
  if (semester) matchStage.semester = parseInt(semester);

  const summary = await Result.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        avgSGPA: { $avg: '$sgpa' },
        avgCGPA: { $avg: '$cgpa' },
        highestSGPA: { $max: '$sgpa' },
        lowestSGPA: { $min: '$sgpa' },
        passed: { $sum: { $cond: ['$isPassed', 1, 0] } },
        failed: { $sum: { $cond: ['$isPassed', 0, 1] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalStudents: 1,
        avgSGPA: { $round: ['$avgSGPA', 2] },
        avgCGPA: { $round: ['$avgCGPA', 2] },
        highestSGPA: 1,
        lowestSGPA: 1,
        passPercentage: { $round: [{ $multiply: [{ $divide: ['$passed', '$totalStudents'] }, 100] }, 2] },
        passed: 1,
        failed: 1
      }
    }
  ]);

  // Top 5
  const toppers = await Result.find(matchStage)
    .populate('student', 'name rollNumber')
    .sort('-sgpa')
    .limit(5);

  res.status(200).json({
    success: true,
    data: {
      summary: summary[0] || {},
      toppers
    }
  });
};

// @desc    Get student transcript (all semesters)
// @route   GET /api/results/transcript/:studentId
exports.getStudentTranscript = async (req, res) => {
  const student = await Student.findById(req.params.studentId)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name');

  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  const results = await Result.find({ student: req.params.studentId })
    .populate('subjects.subjectId', 'name code creditHours type')
    .populate('section', 'name')
    .sort('semester');

  res.status(200).json({
    success: true,
    data: {
      student,
      transcript: results,
      currentCGPA: student.cgpa,
      totalSemesters: results.length
    }
  });
};
