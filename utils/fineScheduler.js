/**
 * Fine Scheduler Utility
 * Checks recurring fine rules and auto-issues fines for eligible students
 */

const Fine = require('../models/Fine');
const FineType = require('../models/FineType');
const Student = require('../models/Student');

/**
 * Check if a fine has already been issued for the current interval
 * @param {String} studentId
 * @param {String} fineTypeId
 * @param {String} interval - 'daily', 'weekly', 'monthly'
 * @returns {Boolean}
 */
const hasBeenIssuedInInterval = async (studentId, fineTypeId, interval) => {
  const now = new Date();
  let startDate;

  switch (interval) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const existingFine = await Fine.findOne({
    student: studentId,
    fineType: fineTypeId,
    issuedDate: { $gte: startDate }
  });

  return !!existingFine;
};

/**
 * Check if max amount has been reached for a recurring fine
 * @param {String} studentId
 * @param {String} fineTypeId
 * @param {Number} maxAmount
 * @returns {Boolean}
 */
const hasReachedMaxAmount = async (studentId, fineTypeId, maxAmount) => {
  if (!maxAmount || maxAmount <= 0) return false;

  const result = await Fine.aggregate([
    {
      $match: {
        student: studentId,
        fineType: fineTypeId,
        status: { $ne: 'waived' }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  return result.length > 0 && result[0].totalAmount >= maxAmount;
};

/**
 * Auto-apply recurring fines for all eligible students
 * @param {String} issuedById - User ID of the person running this
 * @returns {{ issued: Number, skipped: Number, errors: Array }}
 */
const applyRecurringFines = async (issuedById) => {
  const activeFineTypes = await FineType.find({
    isActive: true,
    isRecurring: true
  });

  let issued = 0;
  let skipped = 0;
  const errors = [];

  for (const fineType of activeFineTypes) {
    let students;

    if (fineType.applicableTo === 'all') {
      students = await Student.find({ isActive: true });
    } else {
      students = await Student.find({ isActive: true });
    }

    for (const student of students) {
      try {
        // Check if already issued in this interval
        const alreadyIssued = await hasBeenIssuedInInterval(
          student._id,
          fineType._id,
          fineType.recurringInterval
        );

        if (alreadyIssued) {
          skipped++;
          continue;
        }

        // Check if max amount reached
        if (fineType.maxAmount > 0) {
          const maxReached = await hasReachedMaxAmount(
            student._id,
            fineType._id,
            fineType.maxAmount
          );
          if (maxReached) {
            skipped++;
            continue;
          }
        }

        // Calculate due date based on interval
        const dueDate = new Date();
        switch (fineType.recurringInterval) {
          case 'daily':
            dueDate.setDate(dueDate.getDate() + 1);
            break;
          case 'weekly':
            dueDate.setDate(dueDate.getDate() + 7);
            break;
          case 'monthly':
            dueDate.setMonth(dueDate.getMonth() + 1);
            break;
        }

        await Fine.create({
          student: student._id,
          fineType: fineType._id,
          amount: fineType.defaultAmount,
          reason: `Auto-applied recurring fine: ${fineType.name}`,
          issuedDate: new Date(),
          dueDate,
          issuedBy: issuedById,
          section: student.section,
          class: student.class,
          batch: student.batch,
          semester: student.semester
        });

        // Update student fine total
        await Student.findByIdAndUpdate(student._id, {
          $inc: { totalFineAmount: fineType.defaultAmount }
        });

        issued++;
      } catch (err) {
        errors.push({
          student: student._id,
          fineType: fineType._id,
          error: err.message
        });
      }
    }
  }

  return { issued, skipped, errors };
};

module.exports = { applyRecurringFines, hasBeenIssuedInInterval };
