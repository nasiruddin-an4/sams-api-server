/**
 * Generates a student password based on their name
 * Example: "Nasiruddin" -> "Nasi@4821"
 * @param {string} name - Student's name
 * @returns {string} - Generated password
 */
const generatePassword = (name) => {
  // Take first 4 characters or full name if shorter
  let baseName = name.trim().split(' ')[0];
  if (baseName.length < 4) {
    baseName = baseName.padEnd(4, 'x');
  } else {
    baseName = baseName.substring(0, 4);
  }

  // Capitalize first letter
  baseName = baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();

  // Generate 4 random digits
  const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();

  return `${baseName}@${randomDigits}`;
};

module.exports = { generatePassword };
