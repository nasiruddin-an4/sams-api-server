const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/, 'Please add a valid email']
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  designation: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  joiningDate: {
    type: Date
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time'],
    default: 'Full-time'
  },
  photo: {
    type: String,
    default: 'no-photo.jpg'
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'teacher', 'parent', 'accountant', 'student'],
    default: 'student'
  },
  phone: {
    type: String,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  assignedClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  assignedSections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }],
  employmentStatus: {
    type: String,
    enum: ['active', 'on_leave', 'suspended', 'resigned', 'terminated', 'retired'],
    default: 'active'
  },
  leaveDetails: {
    leaveType: String, // medical / personal / maternity / study
    leaveFrom: Date,
    leaveTo: Date,
    reason: String,
  },
  separationDate: Date,
  separationReason: String,
  isActive: {
    type: Boolean,
    default: true
  },
  fcmTokens: [{
    type: String
  }],
  isFirstLogin: { type: Boolean, default: true },
  emailSent: { type: Boolean, default: false },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Sign Refresh Token and return
UserSchema.methods.getSignedRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRE
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
