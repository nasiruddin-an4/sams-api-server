const mongoose = require('mongoose');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
const Student = require('../models/Student');

/**
 * Creates or updates an active enrollment snapshot for students.
 * Takes snapshots of the section's class teacher and subject teachers.
 */
exports.createEnrollmentSnapshot = async (studentIds, sectionId, academicYear) => {
  const section = await Section.findById(sectionId).populate('department').populate('batch');
  if (!section) throw new Error('Section not found');

  // Fetch all subject-teacher mappings for this section
  const subjectTeachers = await SectionSubjectTeacher.find({ section: sectionId });
  const subjectsSnapshot = subjectTeachers.map(st => ({
    subject: st.subject,
    teacher: st.teacher,
    type: 'theory' // default, could be mapped if subject schema has it
  }));

  const enrollments = [];

  for (const studentId of studentIds) {
    // Check if an active enrollment already exists for this student and semester
    let enrollment = await Enrollment.findOne({
      student: studentId,
      semester: section.semester,
      status: 'active'
    });

    if (enrollment) {
      // If it exists, update it to the new section/teachers (e.g. they transferred but same semester)
      // Wait, user said if they transfer, we should close old and create new.
      // So if createEnrollmentSnapshot is called, it might be for a brand new semester or first time sync.
      
      // Let's just update the snapshot data if we are overriding.
      enrollment.department = section.department._id;
      enrollment.batch = section.batch._id;
      enrollment.section = section._id;
      enrollment.academicYear = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      enrollment.classTeacher = section.teacher;
      enrollment.subjects = subjectsSnapshot;
      
      await enrollment.save();
      enrollments.push(enrollment);
    } else {
      // Create a brand new snapshot
      enrollment = await Enrollment.create({
        student: studentId,
        department: section.department._id,
        batch: section.batch._id,
        section: section._id,
        semester: section.semester,
        academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        classTeacher: section.teacher,
        subjects: subjectsSnapshot,
        status: 'active',
        semesterStart: new Date()
      });
      enrollments.push(enrollment);
    }
  }

  return enrollments;
};

/**
 * Handles transferring a student from one section to another.
 * Marks old enrollment as transferred, creates new one.
 */
exports.transferStudentSection = async (studentId, fromSectionId, toSectionId, reason) => {
  const fromSection = await Section.findById(fromSectionId);
  if (!fromSection) throw new Error('Original section not found');

  // Find active enrollment
  const currentEnrollment = await Enrollment.findOne({
    student: studentId,
    section: fromSectionId,
    status: 'active'
  });

  if (currentEnrollment) {
    currentEnrollment.status = 'transferred';
    currentEnrollment.transferredTo = toSectionId;
    currentEnrollment.transferredAt = new Date();
    currentEnrollment.transferReason = reason || 'Section Transfer';
    await currentEnrollment.save();
  }

  // Create new active enrollment
  const newEnrollments = await this.createEnrollmentSnapshot([studentId], toSectionId);
  return newEnrollments[0];
};

/**
 * Mark all active enrollments in a section as completed.
 */
exports.completeSemester = async (sectionId) => {
  const result = await Enrollment.updateMany(
    { section: sectionId, status: 'active' },
    { 
      status: 'completed',
      semesterEnd: new Date()
    }
  );
  return result;
};
