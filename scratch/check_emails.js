const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const Student = require('../models/Student');
const User = require('../models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const sampleEmail = 'rafiqul.islam@gmail.com';
    const user = await User.findOne({ email: sampleEmail });
    const student = await Student.findOne({ email: sampleEmail });

    console.log(`User with email '${sampleEmail}':`, user ? { id: user._id, name: user.name, role: user.role } : 'Not found');
    console.log(`Student with email '${sampleEmail}':`, student ? { id: student._id, name: student.name, rollNumber: student.rollNumber } : 'Not found');

    const totalStudents = await Student.countDocuments();
    const totalUsers = await User.countDocuments();
    console.log('Total Students in DB:', totalStudents);
    console.log('Total Users in DB:', totalUsers);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
