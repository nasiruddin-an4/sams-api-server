const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a batch name'],
    trim: true,
    maxlength: [100, 'Batch name cannot exceed 100 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Please add a department']
  },
  currentSemester: {
    type: String,
    required: [true, 'Please add a current semester']
  },
  year: {
    type: Number,
    required: [true, 'Please add a year']
  },
  startDate: {
    type: Date,
    required: [true, 'Please add a start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please add an end date']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
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

BatchSchema.virtual('sections', {
  ref: 'Section',
  localField: '_id',
  foreignField: 'batch',
  justOne: false
});

BatchSchema.index({ name: 1, department: 1 }, { unique: true });

const softDelete = require('../utils/softDelete');
BatchSchema.plugin(softDelete);

module.exports = mongoose.model('Batch', BatchSchema);
