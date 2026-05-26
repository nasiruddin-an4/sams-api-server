const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const Student = require('../models/Student');
const User = require('../models/User');
const Department = require('../models/Department');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const bbaDept = await Department.findOne({ code: 'BBA' });
    if (!bbaDept) {
      console.log('BBA Department not found');
      process.exit(0);
    }
    console.log('BBA Department ID:', bbaDept._id);

    const bbaStudents = await Student.find({ class: bbaDept._id });
    console.log('BBA Students Count:', bbaStudents.length);
    if (bbaStudents.length > 0) {
      console.log('Sample Student Rolls:', bbaStudents.slice(0, 5).map(s => s.rollNumber));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
