const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const Student = require('../models/Student');
const User = require('../models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // 1. Delete all students with BBA emails, or since Students is 0, let's clear Students
    const studentDel = await Student.deleteMany({});
    console.log('Deleted Students count:', studentDel.deletedCount);

    // 2. Delete all Users with role 'student' (since there are 0 students, they are all orphans)
    const userDel = await User.deleteMany({ role: 'student' });
    console.log('Deleted Student Users count:', userDel.deletedCount);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
