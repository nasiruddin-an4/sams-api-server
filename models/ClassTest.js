const mongoose = require('mongoose');

const ClassTestSchema = new mongoose.Schema({
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
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  testSeries: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TestSeries',
    required: [true, 'Please add a test series']
  },
  obtainedMarks: {
    type: Number,
    required: [true, 'Please add obtained marks'],
    min: 0
  },
  totalMarks: {
    type: Number,
    required: [true, 'Please add total marks'],
    min: 1
  },
  grade: {
    type: String
  },
  isAbsent: {
    type: Boolean,
    default: false
  },
  remarks: String,
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

ClassTestSchema.index({ student: 1, testSeries: 1 }, { unique: true });
ClassTestSchema.index({ section: 1, subject: 1 });

module.exports = mongoose.model('ClassTest', ClassTestSchema);
