const mongoose = require('mongoose');

const FineTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a fine type name'],
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: [true, 'Please add a fine code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  defaultAmount: {
    type: Number,
    required: [true, 'Please add default amount'],
    min: 0
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringInterval: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'monthly'
  },
  maxAmount: {
    type: Number,
    default: 0
  },
  applicableTo: {
    type: String,
    enum: ['all', 'class', 'section'],
    default: 'all'
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

module.exports = mongoose.model('FineType', FineTypeSchema);
