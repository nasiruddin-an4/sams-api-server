const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('../models/Student');
const Section = require('../models/Section');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');

const migrateEnrollments = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');

    console.log('Fetching active students...');
    const students = await Student.find({ isActive: true });
    let createdCount = 0;

    for (const student of students) {
      if (!student.section || !student.semester || !student.batch || !student.class) {
        continue;
      }

      const existing = await Enrollment.findOne({
        student: student._id,
        semester: student.semester,
        status: 'active'
      });

      // Fetch section to get class teacher
      const section = await Section.findById(student.section);
      if (!section) continue;

      // Fetch subjects
      const subjectTeachers = await SectionSubjectTeacher.find({ section: student.section });
      const subjectsSnapshot = subjectTeachers.map(st => ({
        subject: st.subject,
        teacher: st.teacher,
        type: 'theory'
      }));

      let academicYear = '';
      const batch = await Batch.findById(student.batch);
      if (batch) {
        academicYear = batch.name;
      }

      if (!existing) {
        await Enrollment.create({
          student: student._id,
          department: student.class,
          batch: student.batch,
          section: student.section,
          semester: student.semester,
          academicYear: academicYear,
          classTeacher: section.teacher,
          subjects: subjectsSnapshot,
          status: 'active',
          semesterStart: new Date()
        });
        createdCount++;
      } else {
        existing.department = student.class;
        existing.classTeacher = section.teacher;
        existing.subjects = subjectsSnapshot;
        if (!existing.academicYear) existing.academicYear = academicYear;
        if (!existing.semesterStart) existing.semesterStart = new Date();
        await existing.save();
        createdCount++;
      }
    }

    console.log(`Migration completed successfully. Created ${createdCount} missing enrollments.`);
    process.exit();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrateEnrollments();
