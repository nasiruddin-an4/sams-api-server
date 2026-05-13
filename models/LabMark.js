const mongoose = require('mongoose');

const LabMarkSchema = new mongoose.Schema({
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
  labSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabSession',
    required: [true, 'Please add a lab session']
  },
  sessionDate: {
    type: Date
  },
  experimentTitle: {
    type: String
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
  practicalPerformance: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  vivaMarks: {
    type: Number,
    min: 0,
    default: 0
  },
  labReportMarks: {
    type: Number,
    min: 0,
    default: 0
  },
  attendanceStatus: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'present'
  },
  equipmentUsed: [{
    type: String
  }],
  remarks: String,
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

LabMarkSchema.index({ student: 1, labSession: 1 }, { unique: true });
LabMarkSchema.index({ section: 1, subject: 1 });

module.exports = mongoose.model('LabMark', LabMarkSchema);
