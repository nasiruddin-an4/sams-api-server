const mongoose = require('mongoose');

const SubjectResultSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  theoryMarks: {
    type: Number,
    default: 0
  },
  labMarks: {
    type: Number,
    default: 0
  },
  classTestAvg: {
    type: Number,
    default: 0
  },
  totalObtained: {
    type: Number,
    default: 0
  },
  totalPossible: {
    type: Number,
    default: 0
  },
  grade: String,
  gradePoints: {
    type: Number,
    default: 0
  },
  creditHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Passed', 'Failed', 'Incomplete'],
    default: 'Incomplete'
  }
}, { _id: false });

const ResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please add a student']
  },
  academicYear: {
    type: String,
    required: [true, 'Please add academic year']
  },
  semester: {
    type: Number,
    required: [true, 'Please add semester']
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  subjects: [SubjectResultSchema],
  cgpa: {
    type: Number,
    default: 0,
    min: 0,
    max: 4
  },
  sgpa: {
    type: Number,
    default: 0,
    min: 0,
    max: 4
  },
  totalCredits: {
    type: Number,
    default: 0
  },
  earnedCredits: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number
  },
  sectionSize: {
    type: Number
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

ResultSchema.index({ student: 1, academicYear: 1, semester: 1 }, { unique: true });
ResultSchema.index({ section: 1, semester: 1 });

const softDelete = require('../utils/softDelete');
ResultSchema.plugin(softDelete);

module.exports = mongoose.model('Result', ResultSchema);
