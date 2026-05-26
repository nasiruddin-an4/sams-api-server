const mongoose = require('mongoose');

module.exports = function softDeletePlugin(schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deleteReason: String,
    restoredAt: Date,
    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permanentDeleteAt: Date
  });

  const filterNonDeleted = function(next) {
    const filter = this.getFilter();
    // If the query explicitly filters for isDeleted, do not overwrite it.
    if (filter && (filter.isDeleted === true || filter.isDeleted === false || (filter.isDeleted && typeof filter.isDeleted === 'object'))) {
      return next();
    }
    this.find({ isDeleted: { $ne: true } });
    next();
  };

  schema.pre('find', filterNonDeleted);
  schema.pre('findOne', filterNonDeleted);
  schema.pre('findOneAndUpdate', filterNonDeleted);
  schema.pre('updateMany', filterNonDeleted);
  schema.pre('count', filterNonDeleted);
  schema.pre('countDocuments', filterNonDeleted);

  schema.pre('aggregate', function(next) {
    const pipeline = this.pipeline();
    const hasIsDeletedMatch = pipeline.some(stage => 
      stage.$match && (
        stage.$match.isDeleted === true || 
        stage.$match.isDeleted === false ||
        (stage.$match.isDeleted && typeof stage.$match.isDeleted === 'object')
      )
    );
    if (!hasIsDeletedMatch) {
      pipeline.unshift({ $match: { isDeleted: { $ne: true } } });
    }
    next();
  });

  schema.methods.softDelete = function(userId, reason = '') {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    this.deleteReason = reason;

    // Retention policies:
    // Students, Users, Batches, Sections, Subjects -> 30 days
    // Attendance, Assignments, LabSessions, ClassTests, TestSeries -> 60 days
    // Fines, Results, ExamMarks, LabMarks -> 90 days
    let days = 30;
    const modelName = this.constructor.modelName;
    if (['Attendance', 'Assignment', 'LabSession', 'ClassTest', 'TestSeries'].includes(modelName)) {
      days = 60;
    } else if (['Fine', 'Result', 'ExamMark', 'LabMark'].includes(modelName)) {
      days = 90;
    }

    this.permanentDeleteAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.save();
  };

  schema.methods.restore = function(userId) {
    this.isDeleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;
    this.deleteReason = undefined;
    this.restoredAt = new Date();
    this.restoredBy = userId;
    this.permanentDeleteAt = undefined;
    return this.save();
  };
};
