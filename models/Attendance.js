const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  enrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment'
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'leave', 'holiday'],
    required: true
  },
  remarks: String,
  checkInTime: Date,
  checkOutTime: Date
}, { _id: true });

const AttendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Please add a date']
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
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
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  records: [AttendanceRecordSchema],
  isHoliday: {
    type: Boolean,
    default: false
  },
  isDraft: {
    type: Boolean,
    default: true
  },
  notes: String
}, {
  timestamps: true
});

// Normalize date to start of day before save
AttendanceSchema.pre('save', function (next) {
  if (this.date) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
  next();
});

AttendanceSchema.index({ date: 1, section: 1, subject: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, class: 1 });
AttendanceSchema.index({ 'records.student': 1, date: 1 });

const softDelete = require('../utils/softDelete');
AttendanceSchema.plugin(softDelete);

module.exports = mongoose.model('Attendance', AttendanceSchema);
