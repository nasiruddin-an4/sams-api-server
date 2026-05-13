const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const User = require('../models/User');
const Class = require('../models/Class');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const FineType = require('../models/FineType');
const Fine = require('../models/Fine');
const Attendance = require('../models/Attendance');
const ExamMark = require('../models/ExamMark');
const LabSession = require('../models/LabSession');
const LabMark = require('../models/LabMark');
const TestSeries = require('../models/TestSeries');
const ClassTest = require('../models/ClassTest');
const Result = require('../models/Result');
const AcademicCalendar = require('../models/AcademicCalendar');
const Notification = require('../models/Notification');

const connectDB = require('../config/db');

const clearData = async () => {
  try {
    await connectDB();
    console.log('🧹 Clearing all data except Super Admin...');

    // 1. Delete all other models completely
    await Promise.all([
      Class.deleteMany(),
      Batch.deleteMany(),
      Section.deleteMany(),
      Subject.deleteMany(),
      Student.deleteMany(),
      FineType.deleteMany(),
      Fine.deleteMany(),
      Attendance.deleteMany(),
      ExamMark.deleteMany(),
      LabSession.deleteMany(),
      LabMark.deleteMany(),
      TestSeries.deleteMany(),
      ClassTest.deleteMany(),
      Result.deleteMany(),
      AcademicCalendar.deleteMany(),
      Notification.deleteMany()
    ]);

    // 2. Delete users except Super Admin
    const result = await User.deleteMany({ role: { $ne: 'super_admin' } });
    
    console.log(`✅ Cleared all academic data.`);
    console.log(`✅ Removed ${result.deletedCount} non-super-admin users.`);
    console.log('✨ Super Admin account preserved.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during data clearance:', error);
    process.exit(1);
  }
};

clearData();
