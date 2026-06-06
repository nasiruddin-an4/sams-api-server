const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a student name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  rollNumber: {
    type: String,
    required: [true, 'Please add a roll number'],
    unique: true,
    trim: true
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Please add a class']
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: [true, 'Please add a batch']
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: [true, 'Please add a section']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  phone: {
    type: String,
    maxlength: 20
  },
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  parentInfo: {
    fatherName: String,
    motherName: String,
    guardianName: String,
    guardianPhone: String,
    guardianEmail: String
  },
  parentUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  photo: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'dropout', 'suspended', 'graduated'],
    default: 'active'
  },
  dropoutRemark: {
    type: String,
    trim: true
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  semester: {
    type: Number,
    min: 1,
    max: 12
  },
  program: {
    type: String,
    trim: true
  },
  cgpa: {
    type: Number,
    default: 0,
    min: 0,
    max: 4
  },
  totalFineAmount: {
    type: Number,
    default: 0
  },
  totalFinePaid: {
    type: Number,
    default: 0
  },
  previousSection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },
  sectionChangedAt: {
    type: Date
  },
  sectionChangeReason: {
    type: String
  },
  sectionChangeBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  statusChangedAt: {
    type: Date
  },
  statusChangeReason: {
    type: String
  },
  statusChangeBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

StudentSchema.index({ class: 1, batch: 1, section: 1 });
StudentSchema.index({ name: 'text', rollNumber: 'text', registrationNumber: 'text' });

const softDelete = require('../utils/softDelete');
StudentSchema.plugin(softDelete);

module.exports = mongoose.model('Student', StudentSchema);
