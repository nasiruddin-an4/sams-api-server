/**
 * CGPA Calculator Utility
 * Calculates SGPA and CGPA from grade points and credit hours
 */

/**
 * Calculate SGPA for a single semester
 * @param {Array} subjects - Array of { gradePoints, creditHours }
 * @returns {{ sgpa: Number, totalCredits: Number, earnedCredits: Number }}
 */
const calculateSGPA = (subjects) => {
  if (!subjects || subjects.length === 0) {
    return { sgpa: 0, totalCredits: 0, earnedCredits: 0 };
  }

  let totalWeightedPoints = 0;
  let totalCredits = 0;
  let earnedCredits = 0;

  for (const subject of subjects) {
    const credits = subject.creditHours || 0;
    const gp = subject.gradePoints || 0;

    totalWeightedPoints += gp * credits;
    totalCredits += credits;

    if (gp > 0) {
      earnedCredits += credits;
    }
  }

  const sgpa = totalCredits > 0
    ? Math.round((totalWeightedPoints / totalCredits) * 100) / 100
    : 0;

  return { sgpa, totalCredits, earnedCredits };
};

/**
 * Calculate CGPA across multiple semesters
 * @param {Array} semesterResults - Array of { sgpa, totalCredits, earnedCredits } or Array of subjects arrays
 * @returns {{ cgpa: Number, totalCredits: Number, earnedCredits: Number }}
 */
const calculateCGPA = (semesterResults) => {
  if (!semesterResults || semesterResults.length === 0) {
    return { cgpa: 0, totalCredits: 0, earnedCredits: 0 };
  }

  let totalWeightedSGPA = 0;
  let totalCredits = 0;
  let totalEarnedCredits = 0;

  for (const sem of semesterResults) {
    const sgpa = sem.sgpa || 0;
    const credits = sem.totalCredits || 0;
    const earned = sem.earnedCredits || 0;

    totalWeightedSGPA += sgpa * credits;
    totalCredits += credits;
    totalEarnedCredits += earned;
  }

  const cgpa = totalCredits > 0
    ? Math.round((totalWeightedSGPA / totalCredits) * 100) / 100
    : 0;

  return { cgpa, totalCredits, earnedCredits: totalEarnedCredits };
};

module.exports = { calculateSGPA, calculateCGPA };
