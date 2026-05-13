const TestSeries = require('../models/TestSeries');
const ClassTest = require('../models/ClassTest');
const mongoose = require('mongoose');

// ==================== TEST SERIES ====================

exports.getTestSeries = async (req, res) => {
  const { subjectId, sectionId, academicYear, semester, page = 1, limit = 20 } = req.query;
  const query = {};
  if (subjectId) query.subject = subjectId;
  if (sectionId) query.section = sectionId;
  if (academicYear) query.academicYear = academicYear;
  if (semester) query.semester = parseInt(semester);

  const total = await TestSeries.countDocuments(query);
  const series = await TestSeries.find(query)
    .populate('subject', 'name code')
    .populate('section', 'name')
    .populate('teacher', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('-testDate');

  res.status(200).json({
    success: true, count: series.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: series
  });
};

exports.getTestSeriesById = async (req, res) => {
  const series = await TestSeries.findById(req.params.id)
    .populate('subject', 'name code')
    .populate('section', 'name')
    .populate('teacher', 'name');
  if (!series) return res.status(404).json({ success: false, error: 'Test series not found' });
  res.status(200).json({ success: true, data: series });
};

exports.createTestSeries = async (req, res) => {
  const series = await TestSeries.create(req.body);
  res.status(201).json({ success: true, data: series });
};

exports.updateTestSeries = async (req, res) => {
  const series = await TestSeries.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!series) return res.status(404).json({ success: false, error: 'Test series not found' });
  res.status(200).json({ success: true, data: series });
};

exports.deleteTestSeries = async (req, res) => {
  const series = await TestSeries.findByIdAndDelete(req.params.id);
  if (!series) return res.status(404).json({ success: false, error: 'Test series not found' });
  await ClassTest.deleteMany({ testSeries: req.params.id });
  res.status(200).json({ success: true, data: {} });
};

// ==================== CLASS TEST MARKS ====================

exports.getClassTestMarks = async (req, res) => {
  const { testSeriesId, sectionId, studentId, page = 1, limit = 50 } = req.query;
  const query = {};
  if (testSeriesId) query.testSeries = testSeriesId;
  if (sectionId) query.section = sectionId;
  if (studentId) query.student = studentId;

  const total = await ClassTest.countDocuments(query);
  const marks = await ClassTest.find(query)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('testSeries', 'name testNumber totalMarks testDate')
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

exports.getClassTestMarkById = async (req, res) => {
  const mark = await ClassTest.findById(req.params.id)
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .populate('testSeries', 'name testNumber totalMarks')
    .populate('enteredBy', 'name');
  if (!mark) return res.status(404).json({ success: false, error: 'Class test mark not found' });
  res.status(200).json({ success: true, data: mark });
};

exports.createClassTestMark = async (req, res) => {
  req.body.enteredBy = req.user.id;
  const mark = await ClassTest.create(req.body);
  res.status(201).json({ success: true, data: mark });
};

exports.bulkCreateClassTestMarks = async (req, res) => {
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
      const created = await ClassTest.insertMany(batch, { ordered: false });
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

exports.updateClassTestMark = async (req, res) => {
  const mark = await ClassTest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!mark) return res.status(404).json({ success: false, error: 'Class test mark not found' });
  res.status(200).json({ success: true, data: mark });
};

exports.deleteClassTestMark = async (req, res) => {
  const mark = await ClassTest.findByIdAndDelete(req.params.id);
  if (!mark) return res.status(404).json({ success: false, error: 'Class test mark not found' });
  res.status(200).json({ success: true, data: {} });
};

// @desc    Get class test summary per student (with best-of-N logic)
// @route   GET /api/class-tests/summary/:sectionId
exports.getClassTestSummary = async (req, res) => {
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);
  const { subjectId } = req.query;

  const matchStage = { section: sectionId };
  if (subjectId) matchStage.subject = new mongoose.Types.ObjectId(subjectId);

  // Get all test marks for this section
  const allMarks = await ClassTest.find(matchStage)
    .populate('testSeries', 'name testNumber isBestOfN nCount totalMarks')
    .populate('student', 'name rollNumber')
    .populate('subject', 'name code')
    .sort({ student: 1, 'testSeries.testNumber': 1 });

  // Group by student
  const studentMap = {};
  for (const mark of allMarks) {
    const sid = mark.student._id.toString();
    if (!studentMap[sid]) {
      studentMap[sid] = {
        student: mark.student,
        subject: mark.subject,
        tests: [],
        totalTests: 0
      };
    }
    studentMap[sid].tests.push({
      testSeries: mark.testSeries,
      obtainedMarks: mark.obtainedMarks,
      totalMarks: mark.totalMarks,
      isAbsent: mark.isAbsent,
      percentage: mark.totalMarks > 0 ? (mark.obtainedMarks / mark.totalMarks) * 100 : 0
    });
    studentMap[sid].totalTests++;
  }

  // Calculate best-of-N and averages
  const summary = Object.values(studentMap).map(s => {
    const nonAbsentTests = s.tests.filter(t => !t.isAbsent);
    const sortedByPercent = [...nonAbsentTests].sort((a, b) => b.percentage - a.percentage);

    // Check if any test series has isBestOfN
    const bestOfN = s.tests[0]?.testSeries?.isBestOfN;
    const nCount = s.tests[0]?.testSeries?.nCount || nonAbsentTests.length;

    let bestTests = nonAbsentTests;
    if (bestOfN && nCount > 0 && nCount < nonAbsentTests.length) {
      bestTests = sortedByPercent.slice(0, nCount);
    }

    const bestAvg = bestTests.length > 0
      ? bestTests.reduce((sum, t) => sum + t.percentage, 0) / bestTests.length
      : 0;

    const allAvg = nonAbsentTests.length > 0
      ? nonAbsentTests.reduce((sum, t) => sum + t.percentage, 0) / nonAbsentTests.length
      : 0;

    const highest = nonAbsentTests.length > 0 ? Math.max(...nonAbsentTests.map(t => t.percentage)) : 0;
    const lowest = nonAbsentTests.length > 0 ? Math.min(...nonAbsentTests.map(t => t.percentage)) : 0;

    return {
      studentId: s.student._id,
      studentName: s.student.name,
      rollNumber: s.student.rollNumber,
      subject: s.subject,
      totalTests: s.totalTests,
      isBestOfN: bestOfN || false,
      nCount,
      bestOfNAverage: Math.round(bestAvg * 100) / 100,
      overallAverage: Math.round(allAvg * 100) / 100,
      highest: Math.round(highest * 100) / 100,
      lowest: Math.round(lowest * 100) / 100,
      tests: s.tests
    };
  });

  summary.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

  res.status(200).json({ success: true, count: summary.length, data: summary });
};

// @desc    Get section-wide test performance report
// @route   GET /api/class-tests/section-report/:sectionId
exports.getSectionTestReport = async (req, res) => {
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);

  const report = await ClassTest.aggregate([
    { $match: { section: sectionId, isAbsent: { $ne: true } } },
    {
      $group: {
        _id: { subject: '$subject', testSeries: '$testSeries' },
        totalStudents: { $sum: 1 },
        avgPercentage: { $avg: { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] } },
        highest: { $max: '$obtainedMarks' },
        lowest: { $min: '$obtainedMarks' }
      }
    },
    {
      $lookup: {
        from: 'subjects', localField: '_id.subject', foreignField: '_id', as: 'subject'
      }
    },
    { $unwind: '$subject' },
    {
      $lookup: {
        from: 'testseries', localField: '_id.testSeries', foreignField: '_id', as: 'testSeries'
      }
    },
    { $unwind: '$testSeries' },
    {
      $project: {
        subjectName: '$subject.name',
        subjectCode: '$subject.code',
        testName: '$testSeries.name',
        testNumber: '$testSeries.testNumber',
        totalStudents: 1,
        avgPercentage: { $round: ['$avgPercentage', 2] },
        highest: 1,
        lowest: 1
      }
    },
    { $sort: { subjectCode: 1, testNumber: 1 } }
  ]);

  res.status(200).json({ success: true, count: report.length, data: report });
};
