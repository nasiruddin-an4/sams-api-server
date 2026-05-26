/**
 * Database Seeder
 * Seeds demo data: admin, accountant, teachers, classes, batches, sections, subjects, students, fines, marks, results
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const User = require('../models/User');
const Class = require('../models/Department');
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
const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');

const connectDB = require('../config/db');

const seedData = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting seed process...\n');

    // Clear existing data
    await Promise.all([
      User.deleteMany(),
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
      SectionSubjectTeacher.deleteMany()
    ]);
    console.log('✅ Cleared all existing data');

    // ===== 1. USERS =====
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@university.edu',
      password: 'admin123',
      role: 'admin',
      phone: '01700000001',
      isActive: true
    });

    const accountant = await User.create({
      name: 'Finance Officer',
      email: 'accounts@university.edu',
      password: 'accounts123',
      role: 'accountant',
      phone: '01700000002',
      isActive: true
    });

    const teacher1 = await User.create({
      name: 'Dr. Aminul Islam',
      email: 'teacher1@university.edu',
      password: 'teacher123',
      role: 'teacher',
      phone: '01700000003',
      isActive: true
    });

    const teacher2 = await User.create({
      name: 'Prof. Fatema Begum',
      email: 'teacher2@university.edu',
      password: 'teacher123',
      role: 'teacher',
      phone: '01700000004',
      isActive: true
    });

    const teacher3 = await User.create({
      name: 'Dr. Kamal Hossain',
      email: 'teacher3@university.edu',
      password: 'teacher123',
      role: 'teacher',
      phone: '01700000005',
      isActive: true
    });

    const teacher4 = await User.create({
      name: 'Prof. Nasreen Akter',
      email: 'teacher4@university.edu',
      password: 'teacher123',
      role: 'teacher',
      phone: '01700000006',
      isActive: true
    });

    const parent = await User.create({
      name: 'Mr. Rahman',
      email: 'parent@university.edu',
      password: 'parent123',
      role: 'parent',
      phone: '01700000007',
      isActive: true
    });

    console.log('✅ Created 7 users (1 admin, 1 accountant, 4 teachers, 1 parent)');

    // ===== 2. CLASSES =====
    const class1 = await Class.create({ name: 'Computer Science & Engineering', description: 'CSE Department - 4 year program', isActive: true, createdBy: admin._id });
    const class2 = await Class.create({ name: 'Electrical & Electronic Engineering', description: 'EEE Department - 4 year program', isActive: true, createdBy: admin._id });
    const class3 = await Class.create({ name: 'Business Administration', description: 'BBA Department - 4 year program', isActive: true, createdBy: admin._id });
    console.log('✅ Created 3 classes');

    // ===== 3. BATCHES =====
    const batch1 = await Batch.create({ name: 'Batch 2024', class: class1._id, year: 2024, startDate: new Date('2024-01-15'), endDate: new Date('2027-12-31'), isActive: true, createdBy: admin._id });
    const batch2 = await Batch.create({ name: 'Batch 2025', class: class1._id, year: 2025, startDate: new Date('2025-01-15'), endDate: new Date('2028-12-31'), isActive: true, createdBy: admin._id });
    console.log('✅ Created 2 batches');

    // ===== 4. SECTIONS =====
    const secA = await Section.create({ name: 'Section A', batch: batch1._id, class: class1._id, teacher: teacher1._id, capacity: 60, isActive: true, createdBy: admin._id });
    const secB = await Section.create({ name: 'Section B', batch: batch1._id, class: class1._id, teacher: teacher2._id, capacity: 60, isActive: true, createdBy: admin._id });
    const secC = await Section.create({ name: 'Section C', batch: batch2._id, class: class1._id, teacher: teacher3._id, capacity: 50, isActive: true, createdBy: admin._id });
    const secD = await Section.create({ name: 'Section A', batch: batch1._id, class: class2._id, teacher: teacher4._id, capacity: 45, isActive: true, createdBy: admin._id });
    console.log('✅ Created 4 sections');

    // Update teacher assignments
    await User.findByIdAndUpdate(teacher1._id, { assignedClasses: [class1._id], assignedSections: [secA._id] });
    await User.findByIdAndUpdate(teacher2._id, { assignedClasses: [class1._id], assignedSections: [secB._id] });
    await User.findByIdAndUpdate(teacher3._id, { assignedClasses: [class1._id], assignedSections: [secC._id] });
    await User.findByIdAndUpdate(teacher4._id, { assignedClasses: [class2._id], assignedSections: [secD._id] });

    // ===== 5. SUBJECTS =====
    const sub1 = await Subject.create({ name: 'Data Structures & Algorithms', code: 'CSE201', class: class1._id, teacher: teacher1._id, type: 'both', creditHours: 4, description: 'Fundamental data structures and algorithmic techniques', isActive: true });
    const sub2 = await Subject.create({ name: 'Database Management Systems', code: 'CSE301', class: class1._id, teacher: teacher2._id, type: 'both', creditHours: 3, description: 'Relational databases, SQL, normalization', isActive: true });
    const sub3 = await Subject.create({ name: 'Operating Systems', code: 'CSE302', class: class1._id, teacher: teacher1._id, type: 'theory', creditHours: 3, description: 'Process management, memory management, file systems', isActive: true });
    const sub4 = await Subject.create({ name: 'Digital Electronics Lab', code: 'EEE201L', class: class2._id, teacher: teacher4._id, type: 'lab', creditHours: 2, description: 'Digital logic circuits laboratory', isActive: true });
    const sub5 = await Subject.create({ name: 'Computer Networks', code: 'CSE401', class: class1._id, teacher: teacher3._id, type: 'theory', creditHours: 3, description: 'Network protocols, TCP/IP, routing', isActive: true });
    console.log('✅ Created 5 subjects');

    // ===== 5.5 TEACHER ASSIGNMENTS (SectionSubjectTeacher) =====
    await SectionSubjectTeacher.create({
      section: secA._id,
      subject: sub1._id,
      teacher: teacher1._id,
      batch: batch1._id,
      semester: '3',
      academicYear: '2025-2026',
      isActive: true,
      createdBy: admin._id
    });
    await SectionSubjectTeacher.create({
      section: secA._id,
      subject: sub3._id,
      teacher: teacher1._id,
      batch: batch1._id,
      semester: '3',
      academicYear: '2025-2026',
      isActive: true,
      createdBy: admin._id
    });
    await SectionSubjectTeacher.create({
      section: secB._id,
      subject: sub2._id,
      teacher: teacher2._id,
      batch: batch1._id,
      semester: '3',
      academicYear: '2025-2026',
      isActive: true,
      createdBy: admin._id
    });
    await SectionSubjectTeacher.create({
      section: secC._id,
      subject: sub5._id,
      teacher: teacher3._id,
      batch: batch2._id,
      semester: '3',
      academicYear: '2025-2026',
      isActive: true,
      createdBy: admin._id
    });
    await SectionSubjectTeacher.create({
      section: secD._id,
      subject: sub4._id,
      teacher: teacher4._id,
      batch: batch1._id,
      semester: '1',
      academicYear: '2025-2026',
      isActive: true,
      createdBy: admin._id
    });
    console.log('✅ Created 5 SectionSubjectTeacher assignments');

    // ===== 6. STUDENTS (30) =====
    const studentNames = [
      'Rahim Uddin', 'Karim Ahmed', 'Salma Khatun', 'Nusrat Jahan', 'Tanvir Hasan',
      'Ariful Islam', 'Sharmin Akter', 'Mehedi Hasan', 'Tasnim Rahman', 'Faisal Ahmed',
      'Nazia Sultana', 'Imran Khan', 'Sadia Islam', 'Rakibul Hasan', 'Ayesha Siddiqua',
      'Mahmudul Hasan', 'Fatema Tuz Zohra', 'Shafiqul Islam', 'Mst. Laboni', 'Jubayer Ahmed',
      'Khadija Begum', 'Saiful Islam', 'Ruma Akter', 'Zahidul Islam', 'Tamanna Nasrin',
      'Abdul Karim', 'Sumaiya Islam', 'Rezaul Karim', 'Nazmun Nahar', 'Habibur Rahman'
    ];

    const students = [];
    for (let i = 0; i < 30; i++) {
      let section, batch, cls;
      if (i < 10) { section = secA._id; batch = batch1._id; cls = class1._id; }
      else if (i < 18) { section = secB._id; batch = batch1._id; cls = class1._id; }
      else if (i < 24) { section = secC._id; batch = batch2._id; cls = class1._id; }
      else { section = secD._id; batch = batch1._id; cls = class2._id; }

      const student = await Student.create({
        name: studentNames[i],
        rollNumber: `2024${String(i + 1).padStart(3, '0')}`,
        registrationNumber: `REG-2024-${String(i + 1).padStart(4, '0')}`,
        class: cls,
        batch: batch,
        section: section,
        dateOfBirth: new Date(2002, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: i % 3 === 0 ? 'female' : 'male',
        phone: `0171${String(1000000 + i).slice(0, 7)}`,
        email: `student${i + 1}@university.edu`,
        address: { street: `House ${i + 1}, Road ${i + 5}`, city: 'Dhaka', state: 'Dhaka', zip: '1205' },
        parentInfo: {
          fatherName: `Mr. ${studentNames[i].split(' ')[1] || 'Ahmed'}`,
          motherName: `Mrs. ${studentNames[i].split(' ')[1] || 'Begum'}`,
          guardianName: `Mr. ${studentNames[i].split(' ')[1] || 'Ahmed'}`,
          guardianPhone: `0181${String(2000000 + i).slice(0, 7)}`,
          guardianEmail: `guardian${i + 1}@gmail.com`
        },
        parentUserId: i === 0 ? parent._id : undefined,
        isActive: true,
        admissionDate: new Date('2024-01-15'),
        semester: i < 24 ? 3 : 1,
        program: cls.toString() === class1._id.toString() ? 'B.Sc. in CSE' : 'B.Sc. in EEE',
        cgpa: Math.round((2.5 + Math.random() * 1.5) * 100) / 100
      });
      students.push(student);
    }
    console.log('✅ Created 30 students');

    // ===== 7. FINE TYPES =====
    const ft1 = await FineType.create({ name: 'Late Attendance', code: 'LATE', description: 'Fine for being late to class', defaultAmount: 50, isRecurring: false, applicableTo: 'all', isActive: true, createdBy: admin._id });
    const ft2 = await FineType.create({ name: 'Library Book Overdue', code: 'LIBOVER', description: 'Fine for overdue library books', defaultAmount: 20, isRecurring: true, recurringInterval: 'daily', maxAmount: 500, applicableTo: 'all', isActive: true, createdBy: admin._id });
    const ft3 = await FineType.create({ name: 'Lab Equipment Damage', code: 'LABDMG', description: 'Fine for damaging lab equipment', defaultAmount: 500, isRecurring: false, applicableTo: 'all', isActive: true, createdBy: admin._id });
    const ft4 = await FineType.create({ name: 'ID Card Lost', code: 'IDLOST', description: 'Fine for lost ID card', defaultAmount: 200, isRecurring: false, applicableTo: 'all', isActive: true, createdBy: admin._id });
    const ft5 = await FineType.create({ name: 'Monthly Tuition Late', code: 'TUITION', description: 'Late tuition payment penalty', defaultAmount: 100, isRecurring: true, recurringInterval: 'monthly', maxAmount: 1000, applicableTo: 'all', isActive: true, createdBy: admin._id });
    console.log('✅ Created 5 fine types');

    // ===== 8. SAMPLE FINES =====
    for (let i = 0; i < 8; i++) {
      const studentIdx = Math.floor(Math.random() * 20);
      const fineTypes = [ft1, ft2, ft3, ft4, ft5];
      const ft = fineTypes[i % 5];
      await Fine.create({
        student: students[studentIdx]._id,
        fineType: ft._id,
        amount: ft.defaultAmount,
        reason: `Sample fine: ${ft.name}`,
        issuedDate: new Date(2026, 3, Math.floor(Math.random() * 28) + 1),
        dueDate: new Date(2026, 4, Math.floor(Math.random() * 28) + 1),
        status: i < 3 ? 'paid' : 'pending',
        paidAmount: i < 3 ? ft.defaultAmount : 0,
        paidDate: i < 3 ? new Date() : undefined,
        paymentMethod: i < 3 ? 'cash' : undefined,
        receiptNumber: i < 3 ? `RCPT-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}` : undefined,
        issuedBy: accountant._id,
        section: students[studentIdx].section,
        class: students[studentIdx].class,
        batch: students[studentIdx].batch,
        semester: students[studentIdx].semester
      });
    }
    console.log('✅ Created 8 sample fines');

    // ===== 9. SAMPLE EXAM MARKS =====
    const secAStudents = students.filter(s => s.section.toString() === secA._id.toString());
    for (const student of secAStudents) {
      const total = 100;
      const obtained = Math.floor(40 + Math.random() * 55);
      await ExamMark.create({
        student: student._id,
        subject: sub1._id,
        class: class1._id,
        batch: batch1._id,
        section: secA._id,
        examType: 'midterm',
        academicYear: '2025-2026',
        semester: 3,
        totalMarks: total,
        obtainedMarks: obtained,
        enteredBy: teacher1._id,
        examDate: new Date('2026-03-15')
      });
    }
    console.log(`✅ Created ${secAStudents.length} sample exam marks`);

    // ===== 10. LAB SESSIONS =====
    const labSession1 = await LabSession.create({
      subject: sub1._id,
      section: secA._id,
      teacher: teacher1._id,
      sessionDate: new Date('2026-04-01'),
      startTime: '10:00',
      endTime: '12:00',
      experimentTitle: 'Binary Search Tree Implementation',
      experimentNumber: 1,
      objectives: 'Implement BST insertion, deletion, and traversal',
      equipmentRequired: ['Computer', 'IDE'],
      isCompleted: true
    });

    const labSession2 = await LabSession.create({
      subject: sub1._id,
      section: secA._id,
      teacher: teacher1._id,
      sessionDate: new Date('2026-04-08'),
      startTime: '10:00',
      endTime: '12:00',
      experimentTitle: 'Graph Algorithms - BFS & DFS',
      experimentNumber: 2,
      objectives: 'Implement BFS and DFS traversal algorithms',
      equipmentRequired: ['Computer', 'IDE'],
      isCompleted: true
    });
    console.log('✅ Created 2 lab sessions');

    // ===== 11. LAB MARKS =====
    for (const student of secAStudents) {
      await LabMark.create({
        student: student._id,
        subject: sub1._id,
        section: secA._id,
        labSession: labSession1._id,
        sessionDate: labSession1.sessionDate,
        experimentTitle: labSession1.experimentTitle,
        totalMarks: 30,
        obtainedMarks: Math.floor(15 + Math.random() * 15),
        practicalPerformance: Math.floor(5 + Math.random() * 5),
        vivaMarks: Math.floor(3 + Math.random() * 7),
        labReportMarks: Math.floor(3 + Math.random() * 7),
        attendanceStatus: 'present',
        enteredBy: teacher1._id
      });
    }
    console.log(`✅ Created ${secAStudents.length} lab marks`);

    // ===== 12. TEST SERIES & CLASS TESTS =====
    const testSeries1 = await TestSeries.create({
      name: 'Class Test 1 - DSA',
      subject: sub1._id,
      section: secA._id,
      teacher: teacher1._id,
      testDate: new Date('2026-02-20'),
      totalMarks: 20,
      syllabusCovered: 'Arrays, Linked Lists, Stacks, Queues',
      testNumber: 1,
      academicYear: '2025-2026',
      semester: 3,
      isBestOfN: true,
      nCount: 2
    });

    const testSeries2 = await TestSeries.create({
      name: 'Class Test 2 - DSA',
      subject: sub1._id,
      section: secA._id,
      teacher: teacher1._id,
      testDate: new Date('2026-03-25'),
      totalMarks: 20,
      syllabusCovered: 'Trees, Graphs, Hashing',
      testNumber: 2,
      academicYear: '2025-2026',
      semester: 3,
      isBestOfN: true,
      nCount: 2
    });

    for (const student of secAStudents) {
      await ClassTest.create({
        student: student._id,
        subject: sub1._id,
        section: secA._id,
        testSeries: testSeries1._id,
        obtainedMarks: Math.floor(8 + Math.random() * 12),
        totalMarks: 20,
        enteredBy: teacher1._id
      });
      await ClassTest.create({
        student: student._id,
        subject: sub1._id,
        section: secA._id,
        testSeries: testSeries2._id,
        obtainedMarks: Math.floor(8 + Math.random() * 12),
        totalMarks: 20,
        enteredBy: teacher1._id
      });
    }
    console.log(`✅ Created 2 test series with ${secAStudents.length * 2} class test marks`);

    // ===== 13. ACADEMIC CALENDAR =====
    await AcademicCalendar.create({
      title: 'Eid-ul-Fitr Holiday',
      description: 'University closed for Eid celebration',
      eventType: 'holiday',
      startDate: new Date('2026-03-30'),
      endDate: new Date('2026-04-05'),
      isGlobal: true,
      createdBy: admin._id
    });

    await AcademicCalendar.create({
      title: 'Midterm Examination Week',
      description: 'Midterm exams for all departments',
      eventType: 'exam',
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-03-22'),
      affectedClasses: [class1._id, class2._id, class3._id],
      isGlobal: true,
      createdBy: admin._id
    });

    await AcademicCalendar.create({
      title: 'Project Submission Deadline',
      description: 'Final project submission for CSE students',
      eventType: 'deadline',
      startDate: new Date('2026-05-15'),
      endDate: new Date('2026-05-15'),
      affectedClasses: [class1._id],
      createdBy: admin._id
    });
    console.log('✅ Created 3 academic calendar events');

    // ===== DONE =====
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SEEDING COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📋 Demo Credentials:\n');
    console.log('  Admin:       admin@university.edu      / admin123');
    console.log('  Accountant:  accounts@university.edu   / accounts123');
    console.log('  Teacher 1:   teacher1@university.edu   / teacher123');
    console.log('  Teacher 2:   teacher2@university.edu   / teacher123');
    console.log('  Teacher 3:   teacher3@university.edu   / teacher123');
    console.log('  Teacher 4:   teacher4@university.edu   / teacher123');
    console.log('  Parent:      parent@university.edu     / parent123');
    console.log('\n📊 Data Summary:');
    console.log(`  Users: 7 | Classes: 3 | Batches: 2 | Sections: 4`);
    console.log(`  Subjects: 5 | Students: 30 | Fine Types: 5`);
    console.log(`  Sample Fines: 8 | Exam Marks: ${secAStudents.length}`);
    console.log(`  Lab Sessions: 2 | Lab Marks: ${secAStudents.length}`);
    console.log(`  Test Series: 2 | Class Tests: ${secAStudents.length * 2}`);
    console.log(`  Calendar Events: 3`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error);
    process.exit(1);
  }
};

// Run destroy if -d flag passed
if (process.argv[2] === '-d') {
  const destroyData = async () => {
    await connectDB();
    await Promise.all([
      User.deleteMany(), Class.deleteMany(), Batch.deleteMany(),
      Section.deleteMany(), Subject.deleteMany(), Student.deleteMany(),
      FineType.deleteMany(), Fine.deleteMany(), Attendance.deleteMany(),
      ExamMark.deleteMany(), LabSession.deleteMany(), LabMark.deleteMany(),
      TestSeries.deleteMany(), ClassTest.deleteMany(), Result.deleteMany(),
      AcademicCalendar.deleteMany()
    ]);
    console.log('🗑️  All data destroyed!');
    process.exit(0);
  };
  destroyData();
} else {
  seedData();
}
