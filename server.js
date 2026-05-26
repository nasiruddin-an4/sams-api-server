const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

// Load env vars
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

// Connect to database
const connectDB = require('./config/db');
connectDB();

// Ensure Super Admin exists on boot
const User = require('./models/User');
const ensureSuperAdmin = async () => {
  try {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@diit.edu.bd';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

    let admin = await User.findOne({ 
      $or: [
        { role: 'super_admin' },
        { email: adminEmail }
      ]
    });

    if (!admin) {
      await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'super_admin',
        phone: '01700000000',
        isActive: true
      });
      console.log(`✅ Default Super Admin auto-created: ${adminEmail}`);
    } else {
      if (admin.role !== 'super_admin' || !admin.isActive) {
        admin.role = 'super_admin';
        admin.isActive = true;
        await admin.save();
        console.log(`⚡ Super Admin status restored: ${admin.email}`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to ensure Super Admin exists:', error.message);
  }
};
ensureSuperAdmin();

// Route files
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const batchRoutes = require('./routes/batches');
const sectionRoutes = require('./routes/sections');
const subjectRoutes = require('./routes/subjects');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const examMarkRoutes = require('./routes/examMarks');
const labRoutes = require('./routes/lab');
const classTestRoutes = require('./routes/classTests');
const fineRoutes = require('./routes/fines');
const resultRoutes = require('./routes/results');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const calendarRoutes = require('./routes/calendar');
const notificationRoutes = require('./routes/notifications');
const syncRoutes = require('./routes/sync');
const csvRoutes = require('./routes/csv');
const assignmentRoutes = require('./routes/assignments');
const myRoutes = require('./routes/my');
const trashRoutes = require('./routes/trash');

// Middleware files
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware
app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.PORTAL_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting (skip in development to avoid 429 errors during local dev)
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: { success: false, error: 'Too many requests, please try again later' }
  });
  app.use('/api', limiter);

  // Stricter rate limit for auth routes in production
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { success: false, error: 'Too many login attempts, please try again later' }
  });
  app.use('/api/auth/login', authLimiter);
}

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exam-marks', examMarkRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/class-tests', classTestRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/my', myRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/upload', require('./routes/upload'));

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SAMS API is running', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const { initScheduler } = require('./services/cron');
initScheduler();

const server = app.listen(PORT, () => {
  console.log(`🚀 SAMS Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
