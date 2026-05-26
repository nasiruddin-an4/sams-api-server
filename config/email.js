const nodemailer = require('nodemailer');

/**
 * Send email helper using Nodemailer and Gmail SMTP credentials
 */
const sendMailHelper = async ({ to, subject, text, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"SAMS Admin" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log('Email sent successfully via Gmail. Message ID:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('Gmail SMTP delivery failed:', error);
    return { sent: false };
  }
};

/**
 * Send Welcome Email to student
 * @param {Object} studentData - { name, email, studentId, password }
 * @returns {Promise<Object>} - { sent: boolean }
 */
const sendWelcomeEmail = async (studentData) => {
  try {
    const portalUrl = process.env.PORTAL_URL || 'http://localhost:3000';
    const text = `Dear ${studentData.name},

Your student portal account has been successfully created.

━━━━━━━━━━━━━━━━━━━━━━━━━━
  LOGIN DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Portal     : ${portalUrl}/login
  Student ID : ${studentData.studentId}
  Password   : ${studentData.password} (temporary)
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT: You must change your password on your first login for security.

If you have any issues, please contact your department or the administration office.

Best regards,
SAMS Team`;

    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #4f46e5;">Welcome to SAMS</h2>
  <p>Dear <strong>${studentData.name}</strong>,</p>
  <p>Your student account has been created successfully.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <h3 style="margin-top: 0; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">LOGIN DETAILS</h3>
    <table style="width: 100%; margin-top: 16px;">
      <tr>
        <td style="padding: 8px 0; color: #64748b; width: 100px;">Portal</td>
        <td style="padding: 8px 0;"><strong><a href="${portalUrl}/login" style="color: #4f46e5; text-decoration: none;">Login here</a></strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Student ID</td>
        <td style="padding: 8px 0;"><strong>${studentData.studentId}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Password</td>
        <td style="padding: 8px 0;"><strong>${studentData.password}</strong> <em>(temporary)</em></td>
      </tr>
    </table>
  </div>
  
  <p style="background-color: #fffbeb; color: #b45309; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
    ⚠️ <strong>IMPORTANT:</strong> You must change your password on your first login for security purposes.
  </p>
  
  <p style="margin-top: 32px; font-size: 0.9em; color: #64748b;">
    If you have any issues logging in, please contact your department or the administration office.
  </p>
  <p style="font-size: 0.9em; color: #64748b;">
    &mdash; SAMS Team
  </p>
</div>
`;

    return await sendMailHelper({
      to: studentData.email,
      subject: 'Welcome to SAMS — Your Login Details',
      text,
      html
    });
  } catch (error) {
    console.error('Welcome Email Error:', error);
    return { sent: false };
  }
};

/**
 * Send Welcome Email to teacher
 * @param {Object} teacherData - { name, email, password }
 * @returns {Promise<Object>} - { sent: boolean }
 */
const sendTeacherWelcomeEmail = async (teacherData) => {
  try {
    const portalUrl = process.env.PORTAL_URL || 'http://localhost:3000';
    const text = `Dear ${teacherData.name},

Your SAMS teacher portal account has been successfully created.

━━━━━━━━━━━━━━━━━━━━━━━━━━
  PORTAL LOGIN DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Portal   : ${portalUrl}/login
  Email    : ${teacherData.email}
  Password : ${teacherData.password} (temporary)
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT: You must change your password on your first login for security.

If you have any issues, please contact the administration office.

Best regards,
SAMS Team`;

    const html = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #4f46e5;">Welcome to SAMS</h2>
  <p>Dear <strong>${teacherData.name}</strong>,</p>
  <p>Your SAMS teacher portal account has been created successfully.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <h3 style="margin-top: 0; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">PORTAL LOGIN DETAILS</h3>
    <table style="width: 100%; margin-top: 16px;">
      <tr>
        <td style="padding: 8px 0; color: #64748b; width: 100px;">Portal</td>
        <td style="padding: 8px 0;"><strong><a href="${portalUrl}/login" style="color: #4f46e5; text-decoration: none;">Login here</a></strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Email</td>
        <td style="padding: 8px 0;"><strong>${teacherData.email}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Password</td>
        <td style="padding: 8px 0;"><strong>${teacherData.password}</strong> <em>(temporary)</em></td>
      </tr>
    </table>
  </div>
  
  <p style="background-color: #fffbeb; color: #b45309; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
    ⚠️ <strong>IMPORTANT:</strong> You must change your password on your first login for security purposes.
  </p>
  
  <p style="margin-top: 32px; font-size: 0.9em; color: #64748b;">
    If you have any issues logging in, please contact the administration office.
  </p>
  <p style="font-size: 0.9em; color: #64748b;">
    &mdash; SAMS Team
  </p>
</div>
`;

    return await sendMailHelper({
      to: teacherData.email,
      subject: 'Welcome to SAMS — Your Teacher Account Details',
      text,
      html
    });
  } catch (error) {
    console.error('Welcome Teacher Email Error:', error);
    return { sent: false };
  }
};

module.exports = {
  resend: null, // Placeholder for compatibility
  sendWelcomeEmail,
  sendTeacherWelcomeEmail
};
