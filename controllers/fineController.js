const FineType = require('../models/FineType');
const Fine = require('../models/Fine');
const Student = require('../models/Student');
const { applyRecurringFines } = require('../utils/fineScheduler');
const mongoose = require('mongoose');
const { enqueueNotification } = require('../services/queueService');

// ==================== FINE TYPES ====================

exports.getFineTypes = async (req, res) => {
  const fineTypes = await FineType.find().populate('createdBy', 'name').sort('name');
  res.status(200).json({ success: true, count: fineTypes.length, data: fineTypes });
};

exports.getFineType = async (req, res) => {
  const ft = await FineType.findById(req.params.id).populate('createdBy', 'name');
  if (!ft) return res.status(404).json({ success: false, error: 'Fine type not found' });
  res.status(200).json({ success: true, data: ft });
};

exports.createFineType = async (req, res) => {
  req.body.createdBy = req.user.id;
  const ft = await FineType.create(req.body);
  res.status(201).json({ success: true, data: ft });
};

exports.updateFineType = async (req, res) => {
  const ft = await FineType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!ft) return res.status(404).json({ success: false, error: 'Fine type not found' });
  res.status(200).json({ success: true, data: ft });
};

exports.deleteFineType = async (req, res) => {
  const ft = await FineType.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!ft) return res.status(404).json({ success: false, error: 'Fine type not found' });
  res.status(200).json({ success: true, data: ft });
};

// ==================== FINES ====================

exports.getFines = async (req, res) => {
  const { studentId, sectionId, classId, batchId, status, fineType, from, to, page = 1, limit = 20 } = req.query;
  const query = {};

  if (studentId) query.student = studentId;
  if (sectionId) query.section = sectionId;
  if (classId) query.class = classId;
  if (batchId) query.batch = batchId;
  if (status) query.status = status;
  if (fineType) query.fineType = fineType;
  if (from || to) {
    query.issuedDate = {};
    if (from) query.issuedDate.$gte = new Date(from);
    if (to) query.issuedDate.$lte = new Date(to);
  }

  // Parent: only own child
  if (req.user.role === 'parent') {
    const children = await Student.find({ parentUserId: req.user.id }).select('_id');
    query.student = { $in: children.map(c => c._id) };
  }

  const total = await Fine.countDocuments(query);
  const fines = await Fine.find(query)
    .populate('student', 'name rollNumber')
    .populate('fineType', 'name code')
    .populate('issuedBy', 'name')
    .populate('waivedBy', 'name')
    .populate('section', 'name')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort('-issuedDate');

  res.status(200).json({
    success: true, count: fines.length, total,
    totalPages: Math.ceil(total / limit), currentPage: parseInt(page),
    data: fines
  });
};

exports.getFineById = async (req, res) => {
  const fine = await Fine.findById(req.params.id)
    .populate('student', 'name rollNumber email phone')
    .populate('fineType', 'name code description')
    .populate('issuedBy', 'name')
    .populate('waivedBy', 'name')
    .populate('section', 'name')
    .populate('class', 'name');
  if (!fine) return res.status(404).json({ success: false, error: 'Fine not found' });
  res.status(200).json({ success: true, data: fine });
};

// @desc    Issue fine (single)
exports.issueFine = async (req, res) => {
  req.body.issuedBy = req.user.id;

  // Auto calculate dueDate if not provided (30 days from issue)
  if (!req.body.dueDate) {
    const due = new Date(req.body.issuedDate || Date.now());
    due.setDate(due.getDate() + 30);
    req.body.dueDate = due;
  }

  const fine = await Fine.create(req.body);

  // Update student total fine amount
  await Student.findByIdAndUpdate(fine.student, {
    $inc: { totalFineAmount: fine.amount }
  });

  await fine.populate([
    { path: 'student', select: 'name rollNumber' },
    { path: 'fineType', select: 'name code' }
  ]);

  res.status(201).json({ success: true, data: fine });

  // Send notification
  if (fine.student && fine.student.parentUserId) {
    await enqueueNotification(
      [fine.student.parentUserId],
      'New Fine Issued',
      `A new fine of ${fine.amount} has been issued for: ${fine.reason}`,
      'fine',
      fine._id
    );
  }
};

// @desc    Bulk issue fine to multiple students
// @route   POST /api/fines/bulk
exports.bulkIssueFine = async (req, res) => {
  const { studentIds, fineTypeId, amount, reason, dueDate, sectionId, classId, batchId, semester } = req.body;

  if (!studentIds || !Array.isArray(studentIds)) {
    return res.status(400).json({ success: false, error: 'Please provide an array of studentIds' });
  }

  const fines = studentIds.map(sid => ({
    student: sid,
    fineType: fineTypeId,
    amount,
    reason,
    issuedDate: new Date(),
    dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    issuedBy: req.user.id,
    section: sectionId,
    class: classId,
    batch: batchId,
    semester
  }));

  const results = [];
  const errors = [];

  for (let i = 0; i < fines.length; i += 100) {
    const batch = fines.slice(i, i + 100);
    try {
      const created = await Fine.insertMany(batch, { ordered: false });
      results.push(...created);

      // Update student totals
      for (const f of created) {
        await Student.findByIdAndUpdate(f.student, { $inc: { totalFineAmount: f.amount } });
      }
    } catch (err) {
      if (err.insertedDocs) results.push(...err.insertedDocs);
      errors.push({ batch: Math.floor(i / 100), error: err.message });
    }
  }

  res.status(201).json({
    success: true, inserted: results.length, errors: errors.length,
    errorDetails: errors, data: results
  });
};

exports.updateFine = async (req, res) => {
  const fine = await Fine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!fine) return res.status(404).json({ success: false, error: 'Fine not found' });
  res.status(200).json({ success: true, data: fine });
};

// @desc    Pay fine
// @route   PATCH /api/fines/:id/pay
exports.payFine = async (req, res) => {
  const { paidAmount, paymentMethod } = req.body;
  const fine = await Fine.findById(req.params.id);
  if (!fine) return res.status(404).json({ success: false, error: 'Fine not found' });

  const totalPaid = fine.paidAmount + (paidAmount || fine.amount);
  const receiptNumber = `RCPT-${Date.now()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  fine.paidAmount = totalPaid;
  fine.paidDate = new Date();
  fine.paymentMethod = paymentMethod || 'cash';
  fine.receiptNumber = receiptNumber;
  fine.status = totalPaid >= fine.amount ? 'paid' : 'partial';

  await fine.save();

  // Update student paid total
  await Student.findByIdAndUpdate(fine.student, {
    $inc: { totalFinePaid: paidAmount || fine.amount }
  });

  await fine.populate([
    { path: 'student', select: 'name rollNumber' },
    { path: 'fineType', select: 'name code' }
  ]);

  res.status(200).json({ success: true, data: fine });
};

// @desc    Waive fine
// @route   PATCH /api/fines/:id/waive
exports.waiveFine = async (req, res) => {
  const fine = await Fine.findById(req.params.id);
  if (!fine) return res.status(404).json({ success: false, error: 'Fine not found' });

  fine.status = 'waived';
  fine.waivedBy = req.user.id;
  fine.waivedReason = req.body.reason || 'Waived by admin';
  await fine.save();

  // Reduce student fine total
  await Student.findByIdAndUpdate(fine.student, {
    $inc: { totalFineAmount: -fine.amount }
  });

  res.status(200).json({ success: true, data: fine });
};

exports.deleteFine = async (req, res) => {
  const fine = await Fine.findById(req.params.id);
  if (!fine) return res.status(404).json({ success: false, error: 'Fine not found' });

  if (fine.status !== 'waived') {
    await Student.findByIdAndUpdate(fine.student, {
      $inc: { totalFineAmount: -fine.amount, totalFinePaid: -fine.paidAmount }
    });
  }

  await fine.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');

  res.status(200).json({ success: true, message: 'Fine moved to trash' });
};

// @desc    Get student fines summary
// @route   GET /api/fines/student/:studentId/summary
exports.getStudentFinesSummary = async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.studentId);

  const summary = await Fine.aggregate([
    { $match: { student: studentId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$paidAmount' }
      }
    }
  ]);

  const overdue = await Fine.countDocuments({
    student: studentId,
    status: 'pending',
    dueDate: { $lt: new Date() }
  });

  const totalFines = summary.reduce((sum, s) => sum + s.count, 0);
  const totalAmount = summary.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = summary.reduce((sum, s) => sum + s.totalPaid, 0);

  res.status(200).json({
    success: true,
    data: {
      totalFines,
      totalAmount,
      totalPaid,
      outstanding: totalAmount - totalPaid,
      overdue,
      breakdown: summary
    }
  });
};

// @desc    Get section fines list
// @route   GET /api/fines/section/:sectionId
exports.getSectionFinesList = async (req, res) => {
  const sectionId = new mongoose.Types.ObjectId(req.params.sectionId);

  const fines = await Fine.aggregate([
    { $match: { section: sectionId } },
    {
      $group: {
        _id: '$student',
        totalFines: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$paidAmount' },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } }
      }
    },
    {
      $lookup: {
        from: 'students', localField: '_id', foreignField: '_id', as: 'student'
      }
    },
    { $unwind: '$student' },
    {
      $project: {
        studentName: '$student.name',
        rollNumber: '$student.rollNumber',
        totalFines: 1, totalAmount: 1, totalPaid: 1,
        outstanding: { $subtract: ['$totalAmount', '$totalPaid'] },
        pending: 1, paid: 1
      }
    },
    { $sort: { rollNumber: 1 } }
  ]);

  res.status(200).json({ success: true, count: fines.length, data: fines });
};

// @desc    Auto apply recurring fines
// @route   POST /api/fines/auto-apply
exports.autoApplyRecurringFines = async (req, res) => {
  const result = await applyRecurringFines(req.user.id);
  res.status(200).json({ success: true, data: result });
};
