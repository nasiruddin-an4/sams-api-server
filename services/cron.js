const Student = require('../models/Student');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const ExamMark = require('../models/ExamMark');
const Fine = require('../models/Fine');
const Result = require('../models/Result');
const Assignment = require('../models/Assignment');
const LabSession = require('../models/LabSession');
const LabMark = require('../models/LabMark');
const ClassTest = require('../models/ClassTest');
const TestSeries = require('../models/TestSeries');
const Notification = require('../models/Notification');

const models = [
  { name: 'Student', model: Student },
  { name: 'User', model: User },
  { name: 'Batch', model: Batch },
  { name: 'Section', model: Section },
  { name: 'Subject', model: Subject },
  { name: 'Attendance', model: Attendance },
  { name: 'ExamMark', model: ExamMark },
  { name: 'Fine', model: Fine },
  { name: 'Result', model: Result },
  { name: 'Assignment', model: Assignment },
  { name: 'LabSession', model: LabSession },
  { name: 'LabMark', model: LabMark },
  { name: 'ClassTest', model: ClassTest },
  { name: 'TestSeries', model: TestSeries }
];

const notifyAdmins = async (message) => {
  try {
    const admins = await User.find({ role: { $in: ['super_admin', 'admin'] } });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        title: 'System Trash Cleanup',
        body: message,
        type: 'general'
      });
    }
  } catch (err) {
    console.error('Error notifying admins of cron purge:', err);
  }
};

const purgeExpiredTrash = async () => {
  console.log('⏰ Running daily trash purge job at:', new Date().toISOString());

  const now = new Date();

  for (const item of models) {
    try {
      // Query explicitly for isDeleted: true to bypass the pre-find middleware
      const expiredDocs = await item.model.find({
        isDeleted: true,
        permanentDeleteAt: { $lte: now }
      });

      for (const doc of expiredDocs) {
        const docName = doc.name || doc.title || doc._id;
        const msg = `${item.name} "${docName}" has been permanently deleted from Trash after the retention period expired.`;
        console.log(`🗑️ Purging: ${msg}`);

        // Cascades
        if (item.name === 'Student') {
          if (doc.userId) {
            await User.deleteOne({ _id: doc.userId });
          }
          // Anonymize attendance remarks
          await Attendance.updateMany(
            { 'records.student': doc._id },
            { $set: { 'records.$.remarks': 'Student permanently deleted' } }
          );
        } else if (item.name === 'User') {
          await Student.deleteOne({ userId: doc._id });
        }

        // Hard delete document
        await item.model.deleteOne({ _id: doc._id });

        // Notify admins
        await notifyAdmins(msg);
      }
    } catch (err) {
      console.error(`Error purging expired trash for model ${item.name}:`, err);
    }
  }
};

// Scheduler: run every day at midnight (00:00:00)
const initScheduler = () => {
  const nextRun = new Date();
  nextRun.setHours(24, 0, 0, 0); // Next midnight
  const timeToNextRun = nextRun.getTime() - Date.now();

  console.log(`📅 Daily Trash Purge scheduled. First run in ${Math.round(timeToNextRun / 1000 / 60)} minutes.`);

  setTimeout(() => {
    // Run now
    purgeExpiredTrash();
    // Schedule recurring daily run
    setInterval(purgeExpiredTrash, 24 * 60 * 60 * 1000);
  }, timeToNextRun);

  // For dev/test purposes, run 5 seconds after server start
  if (process.env.NODE_ENV === 'development') {
    setTimeout(purgeExpiredTrash, 5000);
  }
};

module.exports = {
  purgeExpiredTrash,
  initScheduler
};
