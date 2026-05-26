const mongoose = require('mongoose');

const SectionSubjectTeacherSchema = new mongoose.Schema({
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: [true, 'Please add a section']
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Please add a subject']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please assign a teacher']
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: [true, 'Please add a batch']
  },
  semester: {
    type: String,
    required: [true, 'Please add a semester']
  },
  academicYear: {
    type: String,
    required: [true, 'Please add an academic year']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// A specific subject in a specific section can only have one assigned teacher (or at least, unique assignment)
SectionSubjectTeacherSchema.index({ section: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('SectionSubjectTeacher', SectionSubjectTeacherSchema);
