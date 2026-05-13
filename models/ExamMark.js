const mongoose = require('mongoose');
const { calculateGrade } = require('../utils/gradeCalculator');

const ExamMarkSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please add a student']
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Please add a subject']
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  examType: {
    type: String,
    enum: ['midterm', 'final', 'supplementary', 'practical'],
    required: [true, 'Please specify exam type']
  },
  academicYear: {
    type: String,
    required: [true, 'Please add academic year']
  },
  semester: {
    type: Number,
    required: [true, 'Please add semester']
  },
  totalMarks: {
    type: Number,
    required: [true, 'Please add total marks'],
    min: 0
  },
  obtainedMarks: {
    type: Number,
    required: [true, 'Please add obtained marks'],
    min: 0
  },
  grade: {
    type: String
  },
  gradePoints: {
    type: Number
  },
  isPassed: {
    type: Boolean
  },
  remarks: String,
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  examDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Auto-calculate grade before save
ExamMarkSchema.pre('save', function (next) {
  if (this.isModified('obtainedMarks') || this.isModified('totalMarks')) {
    const result = calculateGrade(this.obtainedMarks, this.totalMarks);
    this.grade = result.grade;
    this.gradePoints = result.gradePoints;
    this.isPassed = result.status === 'Passed';
  }
  // Normalize examDate
  if (this.examDate) {
    const d = new Date(this.examDate);
    d.setUTCHours(0, 0, 0, 0);
    this.examDate = d;
  }
  next();
});

ExamMarkSchema.methods.calculateGrade = function () {
  const result = calculateGrade(this.obtainedMarks, this.totalMarks);
  this.grade = result.grade;
  this.gradePoints = result.gradePoints;
  this.isPassed = result.status === 'Passed';
  return result;
};

ExamMarkSchema.index({ student: 1, subject: 1, examType: 1, semester: 1 }, { unique: true });
ExamMarkSchema.index({ section: 1, subject: 1, examType: 1 });

module.exports = mongoose.model('ExamMark', ExamMarkSchema);
