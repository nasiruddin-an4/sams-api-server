const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a batch name'],
    trim: true,
    maxlength: [100, 'Batch name cannot exceed 100 characters']
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Please add a class']
  },
  year: {
    type: Number,
    required: [true, 'Please add a year']
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
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

BatchSchema.index({ name: 1, class: 1 }, { unique: true });

module.exports = mongoose.model('Batch', BatchSchema);
