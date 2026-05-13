const Class = require('../models/Class');
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const AcademicCalendar = require('../models/AcademicCalendar');

// ==================== CLASSES ====================

// @desc    Get all classes
exports.getClasses = async (req, res) => {
  const classes = await Class.find().populate('batches').sort('name');
  res.status(200).json({ success: true, count: classes.length, data: classes });
};

// @desc    Get single class
exports.getClass = async (req, res) => {
  const cls = await Class.findById(req.params.id).populate('batches').populate('sections');
  if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });
  res.status(200).json({ success: true, data: cls });
};

// @desc    Create class
exports.createClass = async (req, res) => {
  req.body.createdBy = req.user.id;
  const cls = await Class.create(req.body);
  res.status(201).json({ success: true, data: cls });
};

// @desc    Update class
exports.updateClass = async (req, res) => {
  const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });
  res.status(200).json({ success: true, data: cls });
};

// @desc    Delete class
exports.deleteClass = async (req, res) => {
  const cls = await Class.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });
  res.status(200).json({ success: true, data: cls });
};

// ==================== BATCHES ====================

exports.getBatches = async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.class = req.query.classId;
  const batches = await Batch.find(filter).populate('class', 'name').populate('sections').sort('-year');
  res.status(200).json({ success: true, count: batches.length, data: batches });
};

exports.getBatch = async (req, res) => {
  const batch = await Batch.findById(req.params.id).populate('class', 'name').populate('sections');
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
  res.status(200).json({ success: true, data: batch });
};

exports.createBatch = async (req, res) => {
  req.body.createdBy = req.user.id;
  const batch = await Batch.create(req.body);
  res.status(201).json({ success: true, data: batch });
};

exports.updateBatch = async (req, res) => {
  const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
  res.status(200).json({ success: true, data: batch });
};

exports.deleteBatch = async (req, res) => {
  const batch = await Batch.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
  res.status(200).json({ success: true, data: batch });
};

// ==================== SECTIONS ====================

exports.getSections = async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.class = req.query.classId;
  if (req.query.batchId) filter.batch = req.query.batchId;

  // Teachers can only see assigned sections
  if (req.user.role === 'teacher') {
    filter._id = { $in: req.user.assignedSections };
  }

  const sections = await Section.find(filter)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('teacher', 'name email')
    .sort('name');

  res.status(200).json({ success: true, count: sections.length, data: sections });
};

exports.getSection = async (req, res) => {
  const section = await Section.findById(req.params.id)
    .populate('class', 'name')
    .populate('batch', 'name year')
    .populate('teacher', 'name email')
    .populate('students');
  if (!section) return res.status(404).json({ success: false, error: 'Section not found' });
  res.status(200).json({ success: true, data: section });
};

exports.createSection = async (req, res) => {
  req.body.createdBy = req.user.id;
  const section = await Section.create(req.body);
  res.status(201).json({ success: true, data: section });
};

exports.updateSection = async (req, res) => {
  const section = await Section.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!section) return res.status(404).json({ success: false, error: 'Section not found' });
  res.status(200).json({ success: true, data: section });
};

exports.deleteSection = async (req, res) => {
  const section = await Section.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!section) return res.status(404).json({ success: false, error: 'Section not found' });
  res.status(200).json({ success: true, data: section });
};

// ==================== SUBJECTS ====================

exports.getSubjects = async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.class = req.query.classId;
  if (req.query.type) filter.type = req.query.type;
  const subjects = await Subject.find(filter)
    .populate('class', 'name')
    .populate('teacher', 'name email')
    .sort('code');
  res.status(200).json({ success: true, count: subjects.length, data: subjects });
};

exports.getSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id)
    .populate('class', 'name')
    .populate('teacher', 'name email');
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
  res.status(200).json({ success: true, data: subject });
};

exports.createSubject = async (req, res) => {
  const subject = await Subject.create(req.body);
  res.status(201).json({ success: true, data: subject });
};

exports.updateSubject = async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
  res.status(200).json({ success: true, data: subject });
};

exports.deleteSubject = async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
  res.status(200).json({ success: true, data: subject });
};

// ==================== ACADEMIC CALENDAR ====================

exports.getCalendar = async (req, res) => {
  const filter = {};
  if (req.query.eventType) filter.eventType = req.query.eventType;
  if (req.query.classId) {
    filter.$or = [
      { isGlobal: true },
      { affectedClasses: req.query.classId }
    ];
  }
  if (req.query.sectionId) {
    filter.$or = filter.$or || [];
    filter.$or.push({ affectedSections: req.query.sectionId });
  }
  if (req.query.from || req.query.to) {
    filter.startDate = {};
    if (req.query.from) filter.startDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.startDate.$lte = new Date(req.query.to);
  }

  const events = await AcademicCalendar.find(filter)
    .populate('affectedClasses', 'name')
    .populate('affectedSections', 'name')
    .populate('createdBy', 'name')
    .sort('startDate');

  res.status(200).json({ success: true, count: events.length, data: events });
};

exports.getCalendarEvent = async (req, res) => {
  const event = await AcademicCalendar.findById(req.params.id)
    .populate('affectedClasses', 'name')
    .populate('affectedSections', 'name')
    .populate('createdBy', 'name');
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  res.status(200).json({ success: true, data: event });
};

exports.createCalendarEvent = async (req, res) => {
  req.body.createdBy = req.user.id;
  const event = await AcademicCalendar.create(req.body);
  res.status(201).json({ success: true, data: event });
};

exports.updateCalendarEvent = async (req, res) => {
  const event = await AcademicCalendar.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  res.status(200).json({ success: true, data: event });
};

exports.deleteCalendarEvent = async (req, res) => {
  const event = await AcademicCalendar.findByIdAndDelete(req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  res.status(200).json({ success: true, data: {} });
};
