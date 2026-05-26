const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a subject name'],
    trim: true,
    maxlength: [200, 'Subject name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'Please add a subject code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Please add a department']
  },
  semester: {
    type: String,
    required: [true, 'Please add a semester']
  },
  type: {
    type: String,
    enum: ['theory', 'lab', 'both'],
    default: 'theory'
  },
  creditHours: {
    type: Number,
    required: [true, 'Please add credit hours'],
    min: 1,
    max: 6
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const softDelete = require('../utils/softDelete');
SubjectSchema.plugin(softDelete);

module.exports = mongoose.model('Subject', SubjectSchema);
