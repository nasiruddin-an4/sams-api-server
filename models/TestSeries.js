const mongoose = require('mongoose');

const TestSeriesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a test name'],
    trim: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Please add a subject']
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: [true, 'Please add a section']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please add a teacher']
  },
  testDate: {
    type: Date,
    required: [true, 'Please add a test date']
  },
  totalMarks: {
    type: Number,
    required: [true, 'Please add total marks'],
    min: 1
  },
  syllabusCovered: {
    type: String
  },
  testNumber: {
    type: Number,
    required: [true, 'Please add test number'],
    min: 1
  },
  academicYear: {
    type: String,
    required: [true, 'Please add academic year']
  },
  semester: {
    type: Number,
    required: [true, 'Please add semester']
  },
  isBestOfN: {
    type: Boolean,
    default: false
  },
  nCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

TestSeriesSchema.index({ subject: 1, section: 1, testNumber: 1 }, { unique: true });

module.exports = mongoose.model('TestSeries', TestSeriesSchema);
