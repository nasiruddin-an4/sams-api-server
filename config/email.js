const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send Welcome Email to student
 * @param {Object} studentData - { name, email, studentId, password }
 * @returns {Promise<Object>} - { sent: boolean }
 */
const sendWelcomeEmail = async (studentData) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: studentData.email,
      subject: 'Welcome to DIIT — Your Student Portal Login Credentials',
      text: `Dear ${studentData.name},

Your student portal account has been successfully created.

━━━━━━━━━━━━━━━━━━━━━━━━━━
  YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Student ID : ${studentData.studentId}
  Email      : ${studentData.email}
  Password   : ${studentData.password}
━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Login here: ${process.env.PORTAL_URL}

⚠️  IMPORTANT: You will be asked to change your 
    password on your first login for security.

If you have any issues, please contact the administration office.

Best regards,
DIIT Administration`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return { sent: true };
  } catch (error) {
    console.error('Email Error:', error);
    return { sent: false };
  }
};

module.exports = {
  transporter,
  sendWelcomeEmail
};
