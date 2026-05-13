const mongoose = require('mongoose');

const LabSessionSchema = new mongoose.Schema({
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
  sessionDate: {
    type: Date,
    required: [true, 'Please add a session date']
  },
  startTime: {
    type: String
  },
  endTime: {
    type: String
  },
  experimentTitle: {
    type: String,
    required: [true, 'Please add experiment title'],
    trim: true
  },
  experimentNumber: {
    type: Number,
    required: [true, 'Please add experiment number']
  },
  objectives: {
    type: String
  },
  equipmentRequired: [{
    type: String
  }],
  isCompleted: {
    type: Boolean,
    default: false
  },
  notes: String
}, {
  timestamps: true
});

LabSessionSchema.index({ subject: 1, section: 1, sessionDate: 1 });

module.exports = mongoose.model('LabSession', LabSessionSchema);
