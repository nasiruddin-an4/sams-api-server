const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const ExamMark = require('../models/ExamMark');
const Fine = require('../models/Fine');
const Result = require('../models/Result');
const User = require('../models/User');
const mongoose = require('mongoose');
const { generatePassword } = require('../utils/passwordGenerator');
const { sendWelcomeEmail } = require('../config/email');

// @desc    Get all students
// @route   GET /api/students
exports.getStudents = async (req, res) => {
  const { classId, batchId, sectionId, gender, isActive, search, semester, program, status, page = 1, limit = 20 } = req.query;
  const query = {};

  if (classId) query.class = classId;
  if (batchId) query.batch = batchId;
  if (gender) query.gender = gender;
  if (status) query.status = status;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (semester) query.semester = parseInt(semester);
  if (program) query.program = { $regex: program, $options: 'i' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
      { registrationNumber: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Teacher can only see assigned sections (direct + SectionSubjectTeacher)
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    const uniqueSectionIds = [...new Set(assignedIds)];

    if (sectionId) {
      if (!uniqueSectionIds.includes(sectionId.toString())) {
        return res.status(403).json({ success: false, error: 'Not authorized to view this section' });
      }
      query.section = sectionId;
    } else {
      query.section = { $in: uniqueSectionIds };
    }
  } else if (sectionId) {
    query.section = sectionId;
  }

  // Parent can only see own child
  if (req.user.role === 'parent') {
    query.parentUserId = req.user.id;
  }

  const total = await Student.countDocuments(query);
  const students = await Student.find(query)
    .populate('class', 'name code')
    .populate('batch', 'name year')
    .populate('section', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('rollNumber');

  // Sanitize personal info for teacher
  let data = students;
  if (req.user.role === 'teacher') {
    data = students.map(s => {
      const obj = s.toObject();
      delete obj.phone;
      delete obj.email;
      delete obj.address;
      delete obj.parentInfo;
      delete obj.parentUserId;
      return obj;
    });
  }

  res.status(200).json({
    success: true,
    count: data.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data
  });
};

// @desc    Get single student
// @route   GET /api/students/:id
exports.getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name teacher')
    .populate('parentUserId', 'name email phone');

  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Parent check
  if (req.user.role === 'parent' && student.parentUserId?.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }

  // Teacher check
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const teacherAssignments = await SectionSubjectTeacher.find({ teacher: req.user.id }).select('section');
    const assignedIds = [
      ...(req.user.assignedSections || []).map(id => id.toString()),
      ...teacherAssignments.map(ta => ta.section.toString())
    ];
    const uniqueSectionIds = [...new Set(assignedIds)];

    if (!uniqueSectionIds.includes(student.section?._id?.toString() || student.section?.toString())) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this student profile' });
    }

    // Sanitize personal info
    const sanitizedStudent = student.toObject();
    delete sanitizedStudent.phone;
    delete sanitizedStudent.email;
    delete sanitizedStudent.address;
    delete sanitizedStudent.parentInfo;
    delete sanitizedStudent.parentUserId;
    
    return res.status(200).json({ success: true, data: sanitizedStudent });
  }

  res.status(200).json({ success: true, data: student });
};

// @desc    Create student
// @route   POST /api/students
exports.createStudent = async (req, res) => {
  const studentData = { ...req.body };
  if (studentData.status) {
    studentData.isActive = studentData.status === 'active';
  }

  // Create user account for student if registration number provided
  let userId;
  let user;
  let generatedPassword;
  
  if (req.body.registrationNumber) {
    generatedPassword = generatePassword(req.body.name);
    user = await User.create({
      name: req.body.name,
      registrationNumber: req.body.registrationNumber,
      password: generatedPassword, 
      role: 'student',
      email: req.body.email || undefined,
      phone: req.body.phone,
      isFirstLogin: true,
      emailSent: false
    });
    userId = user._id;
    studentData.userId = userId;
  }

  const student = await Student.create(studentData);

  // Sync enrollment history
  const { createEnrollmentSnapshot } = require('../services/enrollmentService');
  await createEnrollmentSnapshot([student._id], student.section).catch(err => console.error("Enrollment sync failed on createStudent:", err));

  // Link user back to student and send email
  if (user && req.body.email) {
    user.linkedStudentId = student._id;
    await user.save();

    // Send email asynchronously without blocking the request
    sendWelcomeEmail({
      name: student.name,
      email: student.email,
      studentId: student.rollNumber || student.registrationNumber,
      password: generatedPassword
    }).then(async (emailResult) => {
      if (emailResult.sent) {
        await User.findByIdAndUpdate(user._id, { 
          emailSent: true,
          welcomeEmailSentAt: new Date()
        });
      }
    }).catch(err => console.error("Error sending welcome email in createStudent:", err));
  }

  res.status(201).json({ success: true, data: student });
};

// @desc    Update student
// @route   PUT /api/students/:id
exports.updateStudent = async (req, res) => {
  const updateData = { ...req.body };
  if (updateData.status) {
    updateData.isActive = updateData.status === 'active';
  }

  const student = await Student.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Sync enrollment history
  const { createEnrollmentSnapshot } = require('../services/enrollmentService');
  await createEnrollmentSnapshot([student._id], student.section).catch(err => console.error("Enrollment sync failed on updateStudent:", err));

  // Sync linked User isActive state
  if (student.userId && updateData.status) {
    await User.findByIdAndUpdate(student.userId, { 
      isActive: student.isActive 
    });
  }

  res.status(200).json({ success: true, data: student });
};

// @desc    Delete student (soft delete)
// @route   DELETE /api/students/:id
exports.deleteStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Soft delete linked User account if exists
  if (student.userId) {
    const user = await User.findById(student.userId);
    if (user) {
      user.isActive = false;
      await user.softDelete(req.user.id, req.body.reason || 'Associated student deleted');
    }
  } else if (student.email) {
    // Fallback search by email
    const user = await User.findOne({ email: student.email.toLowerCase() });
    if (user) {
      user.isActive = false;
      await user.softDelete(req.user.id, req.body.reason || 'Associated student deleted');
    }
  }

  await student.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, message: 'Student moved to trash and linked user account deactivated' });
};

// @desc    Bulk create students
// @route   POST /api/students/bulk
exports.bulkCreateStudents = async (req, res) => {
  const { students } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ success: false, error: 'Please provide an array of students' });
  }

  const results = [];
  const errors = [];

  // Process in batches of 100
  for (let i = 0; i < students.length; i += 100) {
    const batch = students.slice(i, i + 100);
    try {
      // Create user accounts for students with registration numbers
      const studentsWithUsers = await Promise.all(batch.map(async (student) => {
        if (student.registrationNumber) {
          try {
            const user = await User.create({
              name: student.name,
              registrationNumber: student.registrationNumber,
              password: student.registrationNumber,
              role: 'student',
              email: student.email || undefined,
              phone: student.phone
            });
            return { ...student, userId: user._id };
          } catch (userErr) {
            // Handle duplicate user registration if exists
            const existingUser = await User.findOne({ registrationNumber: student.registrationNumber });
            if (existingUser) return { ...student, userId: existingUser._id };
          }
        }
        return student;
      }));

      const created = await Student.insertMany(studentsWithUsers, { ordered: false });
      results.push(...created);
    } catch (err) {
      if (err.insertedDocs) results.push(...err.insertedDocs);
      errors.push(...(err.writeErrors || []).map(e => ({ index: i + e.index, error: e.errmsg })));
    }
  }

  res.status(201).json({
    success: true,
    inserted: results.length,
    errors: errors.length,
    errorDetails: errors,
    data: results
  });
};

// @desc    Get student attendance summary
// @route   GET /api/students/:id/attendance-summary
exports.getStudentAttendanceSummary = async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.id);

  const summary = await Attendance.aggregate([
    { $unwind: '$records' },
    { $match: { 'records.student': studentId } },
    {
      $group: {
        _id: '$records.status',
        count: { $sum: 1 }
      }
    }
  ]);

  const totalDays = summary.reduce((acc, s) => acc + s.count, 0);
  const presentDays = summary.find(s => s._id === 'present')?.count || 0;
  const lateDays = summary.find(s => s._id === 'late')?.count || 0;
  const absentDays = summary.find(s => s._id === 'absent')?.count || 0;
  const leaveDays = summary.find(s => s._id === 'leave')?.count || 0;
  const percentage = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100 * 100) / 100 : 0;

  res.status(200).json({
    success: true,
    data: { totalDays, presentDays, lateDays, absentDays, leaveDays, percentage }
  });
};

// @desc    Get student academic summary (attendance + marks + fines + cgpa)
// @route   GET /api/students/:id/academic-summary
exports.getStudentAcademicSummary = async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.id);

  const student = await Student.findById(req.params.id)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('section', 'name');

  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Attendance
  const attendanceSummary = await Attendance.aggregate([
    { $unwind: '$records' },
    { $match: { 'records.student': studentId } },
    { $group: { _id: '$records.status', count: { $sum: 1 } } }
  ]);

  const totalDays = attendanceSummary.reduce((acc, s) => acc + s.count, 0);
  const presentDays = (attendanceSummary.find(s => s._id === 'present')?.count || 0) +
                      (attendanceSummary.find(s => s._id === 'late')?.count || 0);
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100 * 100) / 100 : 0;

  // Exam Marks
  const examMarks = await ExamMark.find({ student: studentId })
    .populate('subject', 'name code')
    .sort('-examDate');

  // Fines
  const fines = await Fine.aggregate([
    { $match: { student: studentId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$paidAmount' }
      }
    }
  ]);

  // Results
  const results = await Result.find({ student: studentId }).sort('-semester');

  // Enrollment History
  const Enrollment = require('../models/Enrollment');
  const enrollments = await Enrollment.find({ student: studentId })
    .populate('class', 'name code')
    .populate('batch', 'name year')
    .populate({
      path: 'section',
      select: 'name teacher',
      populate: {
        path: 'teacher',
        select: 'name email'
      }
    })
    .sort('semester');

  res.status(200).json({
    success: true,
    data: {
      student,
      attendance: { totalDays, presentDays, percentage: attendancePercentage },
      examMarks,
      fines,
      results,
      enrollments,
      cgpa: student.cgpa
    }
  });
};

// @desc    Get complete historical enrollment academic history
// @route   GET /api/students/:id/academic-history
exports.getStudentAcademicHistory = async (req, res) => {
  const studentId = req.params.id;
  const Student = require('../models/Student');
  const Enrollment = require('../models/Enrollment');
  const Attendance = require('../models/Attendance');
  const ExamMark = require('../models/ExamMark');
  const Result = require('../models/Result');

  const student = await Student.findById(studentId).select('name rollNumber department');
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student not found' });
  }

  // Get all enrollments for this student
  const enrollments = await Enrollment.find({ student: studentId })
    .populate('department', 'name')
    .populate('batch', 'name')
    .populate('section', 'name')
    .populate('classTeacher', 'name')
    .populate('subjects.subject', 'name code')
    .populate('subjects.teacher', 'name')
    .sort('semester');

  const history = [];

  for (const enrollment of enrollments) {
    // Attendance stats for this enrollment
    const attendances = await Attendance.find({ 'records.enrollment': enrollment._id });
    let present = 0, absent = 0, late = 0, total = 0;
    attendances.forEach(att => {
      const record = att.records.find(r => r.enrollment && r.enrollment.toString() === enrollment._id.toString());
      if (record) {
        total++;
        if (record.status === 'present') present++;
        if (record.status === 'absent') absent++;
        if (record.status === 'late') late++;
      }
    });
    const attendancePct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    // Exam marks for this enrollment
    const marks = await ExamMark.find({ enrollment: enrollment._id }).populate('subject', 'name');

    // Result for this enrollment
    const result = await Result.findOne({ enrollment: enrollment._id });

    history.push({
      _id: enrollment._id,
      semester: enrollment.semester,
      academicYear: enrollment.academicYear,
      section: enrollment.section,
      classTeacher: enrollment.classTeacher,
      subjects: enrollment.subjects,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      transferredTo: enrollment.transferredTo,
      transferredAt: enrollment.transferredAt,
      attendance: { percentage: attendancePct, present, absent, late, total },
      marks,
      result: result ? { sgpa: result.sgpa, isPassed: result.isPassed } : null
    });
  }

  res.status(200).json({
    success: true,
    data: {
      student,
      enrollments: history,
      cgpa: student.cgpa
    }
  });
};

// @desc    Recalculate student CGPA
// @route   PUT /api/students/:id/update-cgpa
exports.updateStudentCGPA = async (req, res) => {
  const results = await Result.find({ student: req.params.id });

  if (results.length === 0) {
    return res.status(200).json({ success: true, data: { cgpa: 0 } });
  }

  let totalWeighted = 0;
  let totalCredits = 0;

  for (const result of results) {
    totalWeighted += result.sgpa * result.totalCredits;
    totalCredits += result.totalCredits;
  }

  const cgpa = totalCredits > 0 ? Math.round((totalWeighted / totalCredits) * 100) / 100 : 0;

  await Student.findByIdAndUpdate(req.params.id, { cgpa });

  res.status(200).json({ success: true, data: { cgpa, semestersCount: results.length } });
};

// @desc    Get batch overview of sections and student status distribution
// @route   GET /api/students/batch-overview
exports.getBatchOverview = async (req, res) => {
  const Batch = require('../models/Batch');
  const Section = require('../models/Section');

  // Find all batches, populated with department
  const batches = await Batch.find()
    .populate('department', 'name')
    .sort('-year');

  const overview = [];

  for (const batch of batches) {
    // Find all sections for this batch
    const sections = await Section.find({ batch: batch._id })
      .populate('teacher', 'name email');

    const sectionsData = [];
    let totalBatchStudents = 0;

    for (const section of sections) {
      // Aggregate student counts by status for this section
      const studentCounts = await Student.aggregate([
        { $match: { section: section._id, deleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const counts = {
        active: 0,
        dropout: 0,
        suspended: 0,
        graduated: 0,
        total: 0
      };

      studentCounts.forEach(group => {
        const status = group._id || 'active';
        if (status === 'active') counts.active = group.count;
        else if (status === 'dropout') counts.dropout = group.count;
        else if (status === 'suspended') counts.suspended = group.count;
        else if (status === 'graduated') counts.graduated = group.count;
        
        counts.total += group.count;
      });

      totalBatchStudents += counts.total;

      sectionsData.push({
        _id: section._id,
        name: section.name,
        semester: section.semester,
        teacher: section.teacher ? { _id: section.teacher._id, name: section.teacher.name, email: section.teacher.email } : null,
        capacity: section.capacity,
        isActive: section.isActive,
        studentCounts: counts
      });
    }

    overview.push({
      batchId: batch._id,
      name: batch.name,
      year: batch.year,
      department: batch.department,
      totalStudents: totalBatchStudents,
      sections: sectionsData
    });
  }

  res.status(200).json({ success: true, data: overview });
};

// @desc    Move a student to a different section
// @route   PATCH /api/students/:id/move-section
exports.moveSection = async (req, res) => {
  const { newSectionId, reason } = req.body;
  if (!newSectionId) {
    return res.status(450).json({ success: false, error: 'Please specify target section ID' });
  }

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  // Log previous section details
  student.previousSection = student.section;
  student.sectionChangedAt = new Date();
  student.sectionChangeReason = reason || 'Moved by Admin';
  student.sectionChangeBy = req.user.id;
  
  // Update section
  student.section = newSectionId;
  
  await student.save();

  // Sync enrollment history
  const { transferStudentSection } = require('../services/enrollmentService');
  await transferStudentSection(student._id, student.previousSection, newSectionId, reason).catch(err => console.error("Enrollment sync failed on moveSection:", err));

  res.status(200).json({ success: true, data: student });
};

// @desc    Bulk move students to a different section
// @route   PATCH /api/students/bulk-move
exports.bulkMove = async (req, res) => {
  const { studentIds, newSectionId, reason } = req.body;
  if (!newSectionId) {
    return res.status(450).json({ success: false, error: 'Please specify target section ID' });
  }
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Please provide student IDs' });
  }

  const results = [];
  for (const id of studentIds) {
    const student = await Student.findById(id);
    if (student) {
      student.previousSection = student.section;
      student.sectionChangedAt = new Date();
      student.sectionChangeReason = reason || 'Bulk moved by Admin';
      student.sectionChangeBy = req.user.id;
      student.section = newSectionId;
      await student.save();

      // Sync enrollment history
      const { transferStudentSection } = require('../services/enrollmentService');
      await transferStudentSection(student._id, student.previousSection, newSectionId, reason).catch(err => console.error(`Enrollment sync failed on bulkMove for student ${student._id}:`, err));

      results.push(student);
    }
  }

  res.status(200).json({ success: true, count: results.length, data: results });
};

// @desc    Change student status with audit logging and auth access syncing
// @route   PATCH /api/students/:id/status
exports.changeStatus = async (req, res) => {
  const { status, reason, effectiveDate } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, error: 'Please specify a status' });
  }

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

  student.status = status;
  student.isActive = status === 'active';
  student.statusChangedAt = effectiveDate ? new Date(effectiveDate) : new Date();
  student.statusChangeReason = reason || 'Status updated by Admin';
  student.statusChangeBy = req.user.id;

  if (status === 'dropout' && reason) {
    student.dropoutRemark = reason;
  }

  await student.save();

  // Sync enrollment history
  const { createEnrollmentSnapshot } = require('../services/enrollmentService');
  await createEnrollmentSnapshot([student._id], student.section).catch(err => console.error("Enrollment sync failed on changeStatus:", err));

  // Sync linked User login state (isActive)
  if (student.userId) {
    await User.findByIdAndUpdate(student.userId, { 
      isActive: student.isActive 
    });
  }

  res.status(200).json({ success: true, data: student });
};

// @desc    Bulk change student statuses
// @route   PATCH /api/students/bulk-status
exports.bulkChangeStatus = async (req, res) => {
  const { studentIds, status, reason } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, error: 'Please specify a status' });
  }
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Please provide student IDs' });
  }

  const results = [];
  for (const id of studentIds) {
    const student = await Student.findById(id);
    if (student) {
      student.status = status;
      student.isActive = status === 'active';
      student.statusChangedAt = new Date();
      student.statusChangeReason = reason || 'Bulk status updated by Admin';
      student.statusChangeBy = req.user.id;
      
      if (status === 'dropout' && reason) {
        student.dropoutRemark = reason;
      }

      await student.save();

      // Sync enrollment history
      const { createEnrollmentSnapshot } = require('../services/enrollmentService');
      await createEnrollmentSnapshot([student._id], student.section).catch(err => console.error(`Enrollment sync failed on bulkChangeStatus for student ${student._id}:`, err));

      // Sync linked User isActive state
      if (student.userId) {
        await User.findByIdAndUpdate(student.userId, { 
          isActive: student.isActive 
        });
      }
      
      results.push(student);
    }
  }

  res.status(200).json({ success: true, count: results.length, data: results });
};

// @desc    Graduate all students in a specific batch
// @route   PATCH /api/students/graduate-batch
exports.graduateBatch = async (req, res) => {
  const { batchId, reason } = req.body;
  if (!batchId) {
    return res.status(400).json({ success: false, error: 'Please specify batch ID' });
  }

  const User = require('../models/User');

  // Find all students in this batch who are not already graduated
  const students = await Student.find({ batch: batchId, status: { $ne: 'graduated' }, deleted: { $ne: true } });

  if (students.length === 0) {
    return res.status(200).json({ success: true, count: 0, message: 'No active students found in this batch to graduate.' });
  }

  const studentIds = students.map(s => s._id);

  // Update all students in the batch
  await Student.updateMany(
    { _id: { $in: studentIds } },
    {
      $set: {
        status: 'graduated',
        isActive: false,
        statusChangedAt: new Date(),
        statusChangeReason: reason || 'Graduated full batch',
        statusChangeBy: req.user.id
      }
    }
  );

  // Sync enrollment history for all graduated students
  const { createEnrollmentSnapshot } = require('../services/enrollmentService');
  for (const id of studentIds) {
    const s = students.find(st => st._id.toString() === id.toString());
    if(s) await createEnrollmentSnapshot([id], s.section).catch(err => console.error(`Enrollment sync failed on graduateBatch for student ${id}:`, err));
  }

  // Find all linked User IDs
  const userIds = students.map(s => s.userId).filter(Boolean);

  if (userIds.length > 0) {
    // Disable logins for all linked users
    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { isActive: false } }
    );
  }

  res.status(200).json({ success: true, count: studentIds.length, message: `Successfully graduated ${studentIds.length} students.` });
};
