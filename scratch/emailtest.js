const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const nodemailer = require('nodemailer');

console.log('Email User:', process.env.EMAIL_USER);
console.log('Email Service:', process.env.EMAIL_SERVICE);

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const mailOptions = {
  from: process.env.EMAIL_FROM || `"SAMS Test" <${process.env.EMAIL_USER}>`,
  to: process.env.EMAIL_USER, // send to self for testing
  subject: 'SAMS SMTP Verification Test',
  text: 'If you receive this email, your Gmail app password and Nodemailer SMTP transport are working successfully!'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('SMTP Verification failed:', error);
  } else {
    console.log('SMTP Verification success! Message ID:', info.messageId);
  }
});
