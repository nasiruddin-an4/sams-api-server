const csv = require('csv-parser');
const { Readable } = require('stream');
const Student = require('../models/Student');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const { generatePassword } = require('../utils/passwordGenerator');
const { sendWelcomeEmail } = require('../config/email');

// In-memory queue for sending emails sequentially in the background
const emailQueue = [];
let processingQueue = false;

const processEmailQueue = async () => {
  if (processingQueue || emailQueue.length === 0) return;
  processingQueue = true;
  
  while (emailQueue.length > 0) {
    const job = emailQueue.shift();
    try {
      const emailResult = await sendWelcomeEmail({
        name: job.name,
        email: job.email,
        studentId: job.studentId,
        password: job.password
      });
      if (emailResult.sent) {
        await User.findByIdAndUpdate(job.userId, { emailSent: true });
      }
    } catch (err) {
      console.error(`Error sending queued email to ${job.email}:`, err);
    }
    // Wait 1 second between emails to prevent SMTP rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  processingQueue = false;
};

const queueEmail = (emailJob) => {
  emailQueue.push(emailJob);
  processEmailQueue();
};

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
    updated: 0,
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

    // Parse gender with smart fallback guessing
    const genderInput = row.gender || row.Gender || '';
    let gender = 'male';
    const lowerGender = genderInput.toLowerCase().trim();
    if (['male', 'female', 'other'].includes(lowerGender)) {
      gender = lowerGender;
    } else if (name) {
      const femaleKeywords = ['female', 'woman', 'girl', 'she', 'her', 'akter', 'sultana', 'begum', 'jahan', 'habiba', 'tasnim', 'nahar', 'oishee', 'farzana', 'sadia', 'nusrat', 'sharmin', 'umme', 'laboni', 'quamrun', 'begum'];
      const nameLower = name.toLowerCase();
      if (femaleKeywords.some(keyword => nameLower.includes(keyword))) {
        gender = 'female';
      }
    }
    
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
      // 3. Resolve Class, Batch, Section first
      const classDoc = await Department.findOne({
        $or: [
          { name: className },
          { code: className.toUpperCase() }
        ]
      });
      if (!classDoc) {
        summary.failed++;
        failedDetails.push({ row: rowNum, data: row, reason: `Department '${className}' not found in database` });
        continue;
      }

      let batchDoc = await Batch.findOne({ name: batchName, department: classDoc._id });
      if (!batchDoc) {
        try {
          const startYear = parseInt(batchName.match(/\d{4}/)?.[0]) || new Date().getFullYear();
          const endYear = parseInt(batchName.match(/\d{4}/g)?.[1]) || (startYear + 4);
          
          batchDoc = await Batch.create({
            name: batchName,
            department: classDoc._id,
            currentSemester: '1st',
            year: startYear,
            startDate: new Date(`${startYear}-01-01`),
            endDate: new Date(`${endYear}-12-31`),
            isActive: true,
            createdBy: req.user?._id || null
          });
        } catch (err) {
          summary.failed++;
          failedDetails.push({ row: rowNum, data: row, reason: `Failed to auto-create Batch/Session '${batchName}': ${err.message}` });
          continue;
        }
      }

      let sectionDoc = await Section.findOne({ name: sectionName, batch: batchDoc._id });
      if (!sectionDoc) {
        try {
          sectionDoc = await Section.create({
            name: sectionName,
            batch: batchDoc._id,
            department: classDoc._id,
            semester: '1st',
            capacity: 60,
            isActive: true,
            createdBy: req.user?._id || null
          });
        } catch (err) {
          summary.failed++;
          failedDetails.push({ row: rowNum, data: row, reason: `Failed to auto-create Section '${sectionName}' in batch '${batchName}': ${err.message}` });
          continue;
        }
      }

      // 4. Look up existing Student by Roll Number (student_id) OR Email
      let student = await Student.findOne({
        $or: [
          { rollNumber: student_id },
          { email: email.toLowerCase() }
        ]
      });

      if (student) {
        // Update existing student details
        student.name = name;
        student.email = email.toLowerCase();
        student.phone = mobile;
        student.gender = gender;
        student.class = classDoc._id;
        student.batch = batchDoc._id;
        student.section = sectionDoc._id;
        
        const wasInactive = student.status !== 'active';
        student.status = 'active';
        student.isActive = true;
        await student.save();

        // Find or create linked user account
        let user = null;
        if (student.userId) {
          user = await User.findById(student.userId);
        } else {
          user = await User.findOne({ email: email.toLowerCase() });
        }

        if (user) {
          user.name = name;
          user.isActive = true;
          user.registrationNumber = student_id;
          await user.save();
          
          if (!student.userId) {
            student.userId = user._id;
            await student.save();
          }
        } else {
          const generatedPassword = generatePassword(name);
          user = await User.create({
            name,
            email: email.toLowerCase(),
            registrationNumber: student_id,
            password: generatedPassword,
            role: 'student',
            isFirstLogin: true,
            emailSent: false,
            isActive: true
          });
          student.userId = user._id;
          await student.save();
        }

        // Sync enrollment history
        const { syncStudentEnrollment } = require('../utils/enrollmentSync');
        await syncStudentEnrollment(student._id).catch(err => console.error(`Enrollment sync failed on CSV update for student ${student._id}:`, err));

        summary.updated++;
        createdStudents.push({ 
          studentId: student_id, 
          name, 
          email, 
          status: wasInactive ? 'reactivated' : 'updated'
        });
        continue;
      }

      // 5. Look up existing User by Email (Orphan Case)
      let user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.name = name;
        user.registrationNumber = student_id;
        user.isActive = true;
        await user.save();

        student = await Student.create({
          rollNumber: student_id,
          name,
          email: email.toLowerCase(),
          phone: mobile,
          gender,
          class: classDoc._id,
          batch: batchDoc._id,
          section: sectionDoc._id,
          isActive: true,
          status: 'active',
          userId: user._id,
          semester: 1
        });

        // Sync enrollment history
        const { syncStudentEnrollment } = require('../utils/enrollmentSync');
        await syncStudentEnrollment(student._id).catch(err => console.error(`Enrollment sync failed on CSV creation for student ${student._id}:`, err));

        summary.created++; // New student profile created
        createdStudents.push({ 
          studentId: student_id, 
          name, 
          email, 
          status: 'linked_to_existing_user'
        });
        continue;
      }

      // 6. Complete Clean Creation (Both Student and User do not exist)
      const generatedPassword = generatePassword(name);
      
      user = await User.create({
        name,
        email: email.toLowerCase(),
        registrationNumber: student_id,
        password: generatedPassword,
        role: 'student',
        isFirstLogin: true,
        emailSent: false,
        isActive: true
      });

      student = await Student.create({
        rollNumber: student_id,
        name,
        email: email.toLowerCase(),
        phone: mobile,
        gender,
        class: classDoc._id,
        batch: batchDoc._id,
        section: sectionDoc._id,
        isActive: true,
        status: 'active',
        userId: user._id,
        semester: 1
      });

      // Sync enrollment history
      const { syncStudentEnrollment } = require('../utils/enrollmentSync');
      await syncStudentEnrollment(student._id).catch(err => console.error(`Enrollment sync failed on CSV creation for student ${student._id}:`, err));

      // Enqueue welcome email in background (only for new creations)
      queueEmail({
        userId: user._id,
        name,
        email,
        studentId: student_id,
        password: generatedPassword
      });
      summary.emailsSent++;

      summary.created++;
      createdStudents.push({ 
        studentId: student_id, 
        name, 
        email, 
        status: 'created'
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
  const csvContent = 'name,email,student_id,gender,section,batch,department,session,mobile\n' +
    'John Doe,john@gmail.com,CSE-2022-001,male,A,23rd,CSE,2022-2023,01700000000\n' +
    'Jane Smith,jane@gmail.com,CSE-2022-002,female,B,23rd,CSE,2022-2023,01800000000';

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

// @desc    Upload subjects via CSV
// @route   POST /api/csv/upload-subjects
// @access  Private/Admin
exports.uploadSubjects = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Please upload a CSV file' });
  }

  const results = [];
  const summary = {
    totalRows: 0,
    created: 0,
    skipped: 0,
    failed: 0
  };

  const createdSubjects = [];
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

    const name = row.name || row.Name;
    const code = row.code || row.Code;
    const departmentName = row.department || row.Department;
    const semester = row.semester || row.Semester || '1st';
    const type = (row.type || row.Type || 'theory').toLowerCase();
    const creditHours = parseInt(row.creditHours || row.credits || '3') || 3;
    const description = row.description || row.Description || '';

    if (!name || !code || !departmentName) {
      summary.failed++;
      failedDetails.push({
        row: rowNum,
        data: row,
        reason: 'Missing required fields. CSV must contain: name, code, department'
      });
      continue;
    }

    try {
      // Check if subject code already exists
      const subjectExists = await Subject.findOne({ code: code.toUpperCase() });
      if (subjectExists) {
        summary.skipped++;
        skippedDetails.push({
          row: rowNum,
          code,
          name,
          reason: 'Subject code already exists'
        });
        continue;
      }

      // Look up Department by name or code
      const departmentDoc = await Department.findOne({
        $or: [
          { name: departmentName },
          { code: departmentName.toUpperCase() }
        ]
      });

      if (!departmentDoc) {
        summary.failed++;
        failedDetails.push({
          row: rowNum,
          data: row,
          reason: `Department '${departmentName}' not found in database`
        });
        continue;
      }

      // Create Subject
      const subject = await Subject.create({
        name,
        code: code.toUpperCase(),
        department: departmentDoc._id,
        semester,
        type,
        creditHours,
        description
      });

      summary.created++;
      createdSubjects.push({
        code: subject.code,
        name: subject.name
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
    createdSubjects,
    skippedDetails,
    failedDetails
  });
};

// @desc    Download Subject CSV Template
// @route   GET /api/csv/subject-template
// @access  Private/Admin
exports.downloadSubjectTemplate = async (req, res) => {
  const csvContent = 'name,code,department,semester,type,creditHours,description\n' +
    'Data Structures & Algorithms,CSE201,CSE,3rd,both,4,Fundamental data structures and algorithmic techniques\n' +
    'Database Management Systems,CSE301,CSE,5th,both,3,Relational databases and SQL\n' +
    'Principles of Marketing,MKT101,BBA,1st,theory,3,Introduction to marketing concepts';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subject_import_template.csv');
  res.status(200).send(csvContent);
};
