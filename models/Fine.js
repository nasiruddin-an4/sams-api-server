const mongoose = require('mongoose');

const FineSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please add a student']
  },
  fineType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FineType',
    required: [true, 'Please add a fine type']
  },
  amount: {
    type: Number,
    required: [true, 'Please add amount'],
    min: 0
  },
  reason: {
    type: String,
    required: [true, 'Please add a reason']
  },
  issuedDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  paidDate: {
    type: Date
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'waived'],
    default: 'pending'
  },
  waivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  waivedReason: String,
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  semester: Number,
  receiptNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'bank']
  }
}, {
  timestamps: true
});

FineSchema.index({ student: 1, fineType: 1, issuedDate: 1 });
FineSchema.index({ status: 1 });
FineSchema.index({ section: 1 });

module.exports = mongoose.model('Fine', FineSchema);
