const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { sendTeacherWelcomeEmail } = require('../config/email');

console.log('Sending test teacher onboarding email to:', process.env.EMAIL_USER);

sendTeacherWelcomeEmail({
  name: 'Test Teacher',
  email: process.env.EMAIL_USER, // send to self for testing
  password: 'TemporaryPassword123!'
}).then((result) => {
  console.log('Result:', result);
}).catch((err) => {
  console.error('Error:', err);
});
