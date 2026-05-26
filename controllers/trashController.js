const Student = require('../models/Student');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const ExamMark = require('../models/ExamMark');
const Fine = require('../models/Fine');
const Result = require('../models/Result');
const Assignment = require('../models/Assignment');
const LabSession = require('../models/LabSession');
const LabMark = require('../models/LabMark');
const ClassTest = require('../models/ClassTest');
const TestSeries = require('../models/TestSeries');
const mongoose = require('mongoose');

const getModel = (name) => {
  switch (name.toLowerCase()) {
    case 'student': return Student;
    case 'user':
    case 'teacher': return User;
    case 'batch': return Batch;
    case 'section': return Section;
    case 'subject': return Subject;
    case 'attendance': return Attendance;
    case 'exammark': return ExamMark;
    case 'fine': return Fine;
    case 'result': return Result;
    case 'assignment': return Assignment;
    case 'labsession': return LabSession;
    case 'labmark': return LabMark;
    case 'classtest': return ClassTest;
    case 'testseries': return TestSeries;
    default: return null;
  }
};

// @desc    Get all soft deleted items in trash
// @route   GET /api/trash
// @access  Private/Admin
exports.getTrash = async (req, res) => {
  const { type } = req.query;

  const modelsToQuery = type 
    ? [type] 
    : ['student', 'user', 'batch', 'section', 'subject', 'attendance', 'exammark', 'fine', 'result', 'assignment', 'labsession', 'labmark', 'classtest', 'testseries'];

  const results = [];

  const queries = modelsToQuery.map(async (t) => {
    const Model = getModel(t);
    if (!Model) return;

    // Explicitly query for isDeleted: true to bypass the pre-find middleware filter
    let listQuery = Model.find({ isDeleted: true })
      .populate('deletedBy', 'name email');

    // Populate helper fields based on model
    if (t === 'student') {
      listQuery = listQuery.populate('class', 'name').populate('section', 'name').populate('batch', 'name');
    } else if (t === 'section') {
      listQuery = listQuery.populate('department', 'name').populate('batch', 'name');
    } else if (t === 'subject') {
      listQuery = listQuery.populate('department', 'name');
    } else if (t === 'attendance') {
      listQuery = listQuery.populate('section', 'name').populate('subject', 'name code');
    } else if (t === 'exammark') {
      listQuery = listQuery.populate('student', 'name rollNumber').populate('subject', 'name code').populate('section', 'name');
    } else if (t === 'fine') {
      listQuery = listQuery.populate('student', 'name rollNumber').populate('fineType', 'name');
    } else if (t === 'result') {
      listQuery = listQuery.populate('student', 'name rollNumber').populate('section', 'name');
    } else if (t === 'assignment') {
      listQuery = listQuery.populate('section', 'name').populate('subject', 'name code');
    } else if (t === 'labsession') {
      listQuery = listQuery.populate('section', 'name').populate('subject', 'name code');
    } else if (t === 'labmark') {
      listQuery = listQuery.populate('student', 'name rollNumber').populate('subject', 'name code');
    } else if (t === 'classtest') {
      listQuery = listQuery.populate('student', 'name rollNumber').populate('testSeries', 'name');
    } else if (t === 'testseries') {
      listQuery = listQuery.populate('section', 'name').populate('subject', 'name code');
    }

    const docs = await listQuery;
    docs.forEach(doc => {
      let name = doc.name || doc.title || '';
      let identifier = '';
      if (t === 'student') {
        identifier = doc.rollNumber || doc.registrationNumber || '';
      } else if (t === 'user') {
        name = doc.name;
        identifier = `${doc.role?.toUpperCase()} | ${doc.email || doc.employeeId || ''}`;
      } else if (t === 'subject') {
        identifier = doc.code || '';
      } else if (t === 'attendance') {
        name = `Attendance: ${doc.date ? new Date(doc.date).toLocaleDateString() : ''}`;
        identifier = doc.subject?.code || '';
      } else if (t === 'exammark') {
        name = `Marks for ${doc.student?.name || 'Student'}`;
        identifier = `${doc.examType?.toUpperCase()} | ${doc.subject?.code || ''}`;
      } else if (t === 'fine') {
        name = `Fine for ${doc.student?.name || 'Student'}`;
        identifier = `${doc.fineType?.name || 'Fine'} | $${doc.amount}`;
      } else if (t === 'result') {
        name = `Result for ${doc.student?.name || 'Student'}`;
        identifier = `Sem: ${doc.semester}`;
      } else if (t === 'labmark') {
        name = `Lab Mark for ${doc.student?.name || 'Student'}`;
        identifier = doc.subject?.code || '';
      }

      results.push({
        _id: doc._id,
        type: t,
        name,
        identifier,
        deletedAt: doc.deletedAt,
        deletedBy: doc.deletedBy,
        deleteReason: doc.deleteReason,
        permanentDeleteAt: doc.permanentDeleteAt
      });
    });
  });

  await Promise.all(queries);

  // Sort by deletion date descending
  results.sort((a, b) => b.deletedAt - a.deletedAt);

  res.status(200).json({ success: true, count: results.length, data: results });
};

// @desc    Restore a soft deleted item
// @route   PATCH /api/trash/:model/:id/restore
// @access  Private/Admin
exports.restoreItem = async (req, res) => {
  const { model, id } = req.params;

  const Model = getModel(model);
  if (!Model) {
    return res.status(400).json({ success: false, error: 'Invalid model type' });
  }

  const doc = await Model.findOne({ _id: id, isDeleted: true });
  if (!doc) {
    return res.status(404).json({ success: false, error: 'Item not found in trash' });
  }

  await doc.restore(req.user.id);

  // Cascade restore states
  if (model === 'student') {
    doc.isActive = true;
    await doc.save();
    
    // Reactivate and restore linked User
    if (doc.userId) {
      const user = await User.findOne({ _id: doc.userId, isDeleted: true });
      if (user) {
        user.isActive = true;
        await user.restore(req.user.id);
      }
    }
  } else if (model === 'user') {
    doc.isActive = true;
    await doc.save();

    if (doc.role === 'student') {
      const student = await Student.findOne({ userId: doc._id, isDeleted: true });
      if (student) {
        student.isActive = true;
        await student.restore(req.user.id);
      }
    }
  }

  res.status(200).json({ success: true, message: 'Item restored successfully', data: doc });
};

// @desc    Permanently delete an item
// @route   DELETE /api/trash/:model/:id
// @access  Private/Admin
exports.permanentDeleteItem = async (req, res) => {
  const { model, id } = req.params;

  const Model = getModel(model);
  if (!Model) {
    return res.status(400).json({ success: false, error: 'Invalid model type' });
  }

  const doc = await Model.findOne({ _id: id, isDeleted: true });
  if (!doc) {
    return res.status(404).json({ success: false, error: 'Item not found in trash' });
  }

  // Handle student cascade
  if (model === 'student') {
    if (doc.userId) {
      await User.deleteOne({ _id: doc.userId });
    }
    // Anonymize attendance
    await Attendance.updateMany(
      { 'records.student': doc._id },
      { $set: { 'records.$.remarks': 'Student permanently deleted' } }
    );
  } else if (model === 'user') {
    await Student.deleteOne({ userId: doc._id });
  }

  await Model.deleteOne({ _id: id });

  res.status(200).json({ success: true, message: 'Item permanently deleted from database' });
};

// @desc    Empty trash
// @route   DELETE /api/trash/empty
// @access  Private/Admin
exports.emptyTrash = async (req, res) => {
  const { type } = req.query;

  const modelsToClear = type 
    ? [type] 
    : ['student', 'user', 'batch', 'section', 'subject', 'attendance', 'exammark', 'fine', 'result', 'assignment', 'labsession', 'labmark', 'classtest', 'testseries'];

  for (const t of modelsToClear) {
    const Model = getModel(t);
    if (!Model) continue;

    const expiredDocs = await Model.find({ isDeleted: true });
    for (const doc of expiredDocs) {
      if (t === 'student') {
        if (doc.userId) await User.deleteOne({ _id: doc.userId });
        await Attendance.updateMany(
          { 'records.student': doc._id },
          { $set: { 'records.$.remarks': 'Student permanently deleted' } }
        );
      } else if (t === 'user') {
        await Student.deleteOne({ userId: doc._id });
      }
      await Model.deleteOne({ _id: doc._id });
    }
  }

  res.status(200).json({ success: true, message: 'Trash emptied successfully' });
};
