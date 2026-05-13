const mongoose = require('mongoose');

const AcademicCalendarSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  eventType: {
    type: String,
    enum: ['holiday', 'exam', 'test', 'labSession', 'event', 'deadline'],
    required: [true, 'Please add event type']
  },
  startDate: {
    type: Date,
    required: [true, 'Please add start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please add end date']
  },
  affectedClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  affectedSections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }],
  isGlobal: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

AcademicCalendarSchema.index({ startDate: 1, endDate: 1 });
AcademicCalendarSchema.index({ eventType: 1 });

module.exports = mongoose.model('AcademicCalendar', AcademicCalendarSchema);
