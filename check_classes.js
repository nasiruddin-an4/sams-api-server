const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const classes = await db.collection('classes').find({}).toArray();
  console.log(`Classes collection count: ${classes.length}`);
  if (classes.length > 0) {
    console.log('Sample:', classes.slice(0, 5));
  }
  await mongoose.disconnect();
}
run();
