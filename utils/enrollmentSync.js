const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');

/**
 * Synchronize the student's active semester/section state to the historical Enrollment collection.
 * @param {string|ObjectId} studentId - The ID of the student to sync.
 */
const syncStudentEnrollment = async (studentId) => {
  try {
    const student = await Student.findById(studentId);
    if (!student) {
      console.warn(`[Sync Enrollment] Student not found: ${studentId}`);
      return null;
    }

    if (!student.class || !student.batch || !student.section || !student.semester) {
      console.warn(`[Sync Enrollment] Student ${studentId} lacks required class/batch/section/semester values. Skipping.`);
      return null;
    }

    // Resolve academic year from the batch name (e.g. "2024-2028")
    let academicYear = '';
    const batch = await Batch.findById(student.batch);
    if (batch) {
      academicYear = batch.name;
    }

    const enrollmentStatus = student.status === 'active' ? 'active' : student.status;

    const enrollment = await Enrollment.findOneAndUpdate(
      { student: student._id, semester: student.semester },
      {
        class: student.class,
        batch: student.batch,
        section: student.section,
        status: enrollmentStatus,
        academicYear: academicYear
      },
      { upsert: true, new: true }
    );

    return enrollment;
  } catch (error) {
    console.error(`[Sync Enrollment] Error syncing student ${studentId}:`, error);
    throw error;
  }
};

module.exports = { syncStudentEnrollment };
