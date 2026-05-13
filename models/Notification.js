const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['attendance', 'exam', 'fine', 'notice', 'general'],
    default: 'general'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    // Could refer to an Attendance, ExamMark, or Fine document depending on type
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
