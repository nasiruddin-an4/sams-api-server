const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const User = require('../models/User');
const connectDB = require('../config/db');

const createSuperAdmin = async () => {
  try {
    await connectDB();
    console.log('🌱 Creating Super Admin...');

    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@diit.edu.bd';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

    // Check if super admin already exists
    let admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
      console.log('Super Admin already exists, updating role and password...');
      admin.role = 'super_admin';
      admin.password = adminPassword;
      admin.name = adminName;
      await admin.save();
      console.log('✅ Super Admin updated.');
    } else {
      admin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'super_admin',
        phone: '01700000000',
        isActive: true
      });
      console.log('✅ Super Admin created.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

createSuperAdmin();
