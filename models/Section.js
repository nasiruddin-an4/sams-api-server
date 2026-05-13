const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a section name'],
    trim: true,
    maxlength: [50, 'Section name cannot exceed 50 characters']
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: [true, 'Please add a batch']
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Please add a class']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  capacity: {
    type: Number,
    default: 60
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

SectionSchema.virtual('students', {
  ref: 'Student',
  localField: '_id',
  foreignField: 'section',
  justOne: false
});

SectionSchema.index({ name: 1, batch: 1, class: 1 }, { unique: true });

module.exports = mongoose.model('Section', SectionSchema);
