const mongoose = require('mongoose');
const Student = require('../models/Student');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const females = [
  "Farzana Akter",
  "Nusrat Jahan",
  "Sadia Sultana",
  "Umme Habiba",
  "Zarin Tasnim",
  "Laboni Begum",
  "Oishee Chowdhury",
  "Quamrun Nahar",
  "Sharmin Akter"
];

async function updateGenders() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Update all to male first as a baseline
    const resMale = await Student.updateMany({}, { $set: { gender: 'male' } });
    console.log(`Updated to male default: ${resMale.modifiedCount || resMale.nModified}`);

    // Update specific females
    const resFemale = await Student.updateMany(
      { name: { $in: females } },
      { $set: { gender: 'female' } }
    );
    console.log(`Updated to female: ${resFemale.modifiedCount || resFemale.nModified}`);

    // Confirm stats
    const stats = await Student.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);
    console.log('New Gender stats in DB:');
    console.log(JSON.stringify(stats, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateGenders();
