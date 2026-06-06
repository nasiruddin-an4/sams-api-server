const mongoose = require('mongoose');

const StudentEnrollmentSchema = new mongoose.Schema({
  // Who
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  
  // Where (snapshot at enrollment time)
  department: {
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
  semester: {
    type: Number,
    required: true
  },
  academicYear: {
    type: String
  },
  
  // Class teacher AT THAT TIME (snapshot)
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Subjects enrolled this semester (snapshot)
  subjects: [{
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String
    }
  }],
  
  // Enrollment dates
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  semesterStart: {
    type: Date
  },
  semesterEnd: {
    type: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'dropped', 'transferred'],
    default: 'active'
  },
  
  // If transferred — where did they go
  transferredTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  transferredAt: {
    type: Date
  },
  transferReason: {
    type: String
  }
}, {
  timestamps: true
});

// A student should only have one active enrollment per semester
StudentEnrollmentSchema.index({ student: 1, semester: 1, status: 1 });

const softDelete = require('../utils/softDelete');
StudentEnrollmentSchema.plugin(softDelete);

module.exports = mongoose.model('Enrollment', StudentEnrollmentSchema);
