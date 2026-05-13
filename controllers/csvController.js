const csv = require('csv-parser');
const { Readable } = require('stream');
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const { generatePassword } = require('../utils/passwordGenerator');
const { sendWelcomeEmail } = require('../config/email');

// @desc    Upload students via CSV
// @route   POST /api/csv/upload-students
// @access  Private/Admin
exports.uploadStudents = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Please upload a CSV file' });
  }

  const results = [];
  const summary = {
    totalRows: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    emailsSent: 0,
    emailsFailed: 0
  };

  const createdStudents = [];
  const skippedDetails = [];
  const failedDetails = [];

  // Parse CSV from buffer
  const stream = Readable.from(req.file.buffer.toString());

  const parsePromise = new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  await parsePromise;

  summary.totalRows = results.length;

  // Process rows sequentially
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    const rowNum = i + 1;

    // 1. Validate required fields with strict institution mapping
    const student_id = row.student_id || row.studentId || row.ID;
    const name = row.name || row.Name;
    const email = row.email || row.Email;
    const mobile = row.mobile || row.phone || '';
    const className = row.department || row.class; // User prioritized 'department'
    const batchName = row.batch || row.session;   // User prioritized 'batch'/'session'
    const sectionName = row.section || row.Section;
    
    if (!student_id || !name || !email || !className || !batchName || !sectionName) {
      summary.failed++;
      failedDetails.push({ 
        row: rowNum, 
        data: row, 
        reason: `Missing required fields. CSV must contain: student_id, name, email, section, batch/session, department.` 
      });
      continue;
    }

    // 2. Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      summary.failed++;
      failedDetails.push({ 
        row: rowNum, 
        data: row, 
        reason: 'Invalid email format' 
      });
      continue;
    }

    try {
      // 3. Check if Student ID exists (rollNumber in model)
      const studentExists = await Student.findOne({ rollNumber: student_id });
      if (studentExists) {
        summary.skipped++;
        skippedDetails.push({ 
          row: rowNum, 
          studentId: student_id, 
          name, 
          reason: 'Student ID (Roll Number) already exists' 
        });
        continue;
      }

      // 4. Check if Email exists in User collection
      const userExists = await User.findOne({ email: email.toLowerCase() });
      if (userExists) {
        summary.skipped++;
        skippedDetails.push({ 
          row: rowNum, 
          studentId: student_id, 
          name, 
          reason: 'Email already exists' 
        });
        continue;
      }

      // 5. Look up Class, Batch, Section
      const classDoc = await Class.findOne({ name: className });
      if (!classDoc) {
        summary.failed++;
        failedDetails.push({ row: rowNum, data: row, reason: `Department '${className}' not found in database` });
        continue;
      }

      const batchDoc = await Batch.findOne({ name: batchName, class: classDoc._id });
      if (!batchDoc) {
        summary.failed++;
        failedDetails.push({ row: rowNum, data: row, reason: `Batch/Session '${batchName}' not found for department '${className}'` });
        continue;
      }

      const sectionDoc = await Section.findOne({ name: sectionName, batch: batchDoc._id });
      if (!sectionDoc) {
        summary.failed++;
        failedDetails.push({ row: rowNum, data: row, reason: `Section '${sectionName}' not found in batch '${batchName}'` });
        continue;
      }

      // 6. Create Student and User
      const generatedPassword = generatePassword(name);

      const student = await Student.create({
        rollNumber: student_id,
        name,
        email,
        phone: mobile,
        class: classDoc._id,
        batch: batchDoc._id,
        section: sectionDoc._id,
        isActive: true,
        semester: 1 // Default
      });

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        registrationNumber: student_id,
        password: generatedPassword,
        role: 'student',
        isFirstLogin: true,
        emailSent: false,
        isActive: true
      });

      // Link User to Student
      student.userId = user._id;
      await student.save();

      // 7. Send Welcome Email
      const emailResult = await sendWelcomeEmail({
        name,
        email,
        studentId: student_id,
        password: generatedPassword
      });

      if (emailResult.sent) {
        user.emailSent = true;
        await user.save();
        summary.emailsSent++;
      } else {
        summary.emailsFailed++;
      }

      summary.created++;
      createdStudents.push({ 
        studentId: student_id, 
        name, 
        email, 
        emailSent: user.emailSent 
      });

    } catch (error) {
      summary.failed++;
      failedDetails.push({ 
        row: rowNum, 
        data: row, 
        reason: error.message 
      });
    }
  }

  res.status(200).json({
    success: true,
    summary,
    createdStudents,
    skippedDetails,
    failedDetails
  });
};

// @desc    Download CSV Template
// @route   GET /api/csv/template
// @access  Private/Admin
exports.downloadTemplate = async (req, res) => {
  const csvContent = 'name,email,student_id,section,batch,department,session,mobile\n' +
    'John Doe,john@gmail.com,CSE-2022-001,A,23rd,CSE,2022-2023,01700000000\n' +
    'Jane Smith,jane@gmail.com,CSE-2022-002,B,23rd,CSE,2022-2023,01800000000';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=student_enrollment_template.csv');
  res.status(200).send(csvContent);
};

// @desc    Resend Credentials to student
// @route   POST /api/csv/resend-credentials/:studentId
// @access  Private/Admin
exports.resendCredentials = async (req, res) => {
  const student = await Student.findOne({ studentId: req.params.studentId });
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student not found' });
  }

  const user = await User.findOne({ registrationNumber: student.studentId });
  if (!user) {
    return res.status(404).json({ success: false, error: 'User account not found' });
  }

  const newPassword = generatePassword(student.name);
  user.password = newPassword;
  user.isFirstLogin = true;
  user.emailSent = false;
  await user.save();

  const emailResult = await sendWelcomeEmail({
    name: student.name,
    email: student.email,
    studentId: student.studentId,
    password: newPassword
  });

  if (emailResult.sent) {
    user.emailSent = true;
    await user.save();
    return res.status(200).json({ success: true, message: 'Credentials resent successfully' });
  } else {
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
};
