const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: 2000
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Please associate a subject']
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: [true, 'Please associate a batch']
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: [true, 'Please associate a section']
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add a due date']
  },
  totalMarks: {
    type: Number,
    required: [true, 'Please add total marks'],
    default: 100
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

AssignmentSchema.index({ subject: 1 });
AssignmentSchema.index({ batch: 1 });
AssignmentSchema.index({ section: 1 });
AssignmentSchema.index({ dueDate: 1 });

const softDelete = require('../utils/softDelete');
AssignmentSchema.plugin(softDelete);

module.exports = mongoose.model('Assignment', AssignmentSchema);
