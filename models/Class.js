const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a class name'],
    trim: true,
    unique: true,
    maxlength: [100, 'Class name cannot exceed 100 characters']
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

// Reverse populate with virtuals
ClassSchema.virtual('batches', {
  ref: 'Batch',
  localField: '_id',
  foreignField: 'class',
  justOne: false
});

ClassSchema.virtual('sections', {
  ref: 'Section',
  localField: '_id',
  foreignField: 'class',
  justOne: false
});

module.exports = mongoose.model('Class', ClassSchema);
