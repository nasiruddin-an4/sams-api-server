/**
 * Grade Calculator Utility
 * Configurable grading scale for university marking system
 */

const DEFAULT_SCALE = [
  { min: 90, grade: 'A+', gradePoints: 4.0 },
  { min: 85, grade: 'A',  gradePoints: 3.75 },
  { min: 80, grade: 'A-', gradePoints: 3.5 },
  { min: 75, grade: 'B+', gradePoints: 3.25 },
  { min: 70, grade: 'B',  gradePoints: 3.0 },
  { min: 65, grade: 'B-', gradePoints: 2.75 },
  { min: 60, grade: 'C+', gradePoints: 2.5 },
  { min: 55, grade: 'C',  gradePoints: 2.25 },
  { min: 50, grade: 'C-', gradePoints: 2.0 },
  { min: 45, grade: 'D+', gradePoints: 1.75 },
  { min: 40, grade: 'D',  gradePoints: 1.5 },
  { min: 0,  grade: 'F',  gradePoints: 0.0 }
];

/**
 * Calculate grade from obtained and total marks
 * @param {Number} obtainedMarks
 * @param {Number} totalMarks
 * @param {Array} scale - optional custom grading scale
 * @returns {{ percentage: Number, grade: String, gradePoints: Number, status: String }}
 */
const calculateGrade = (obtainedMarks, totalMarks, scale = DEFAULT_SCALE) => {
  if (totalMarks <= 0) {
    return { percentage: 0, grade: 'F', gradePoints: 0, status: 'Failed' };
  }

  const percentage = (obtainedMarks / totalMarks) * 100;
  let grade = 'F';
  let gradePoints = 0;

  for (const s of scale) {
    if (percentage >= s.min) {
      grade = s.grade;
      gradePoints = s.gradePoints;
      break;
    }
  }

  const status = grade === 'F' ? 'Failed' : 'Passed';

  return {
    percentage: Math.round(percentage * 100) / 100,
    grade,
    gradePoints,
    status
  };
};

/**
 * Get grade letter for a percentage
 * @param {Number} percentage
 * @returns {String}
 */
const getGradeLetter = (percentage) => {
  const result = calculateGrade(percentage, 100);
  return result.grade;
};

module.exports = { calculateGrade, getGradeLetter, DEFAULT_SCALE };
