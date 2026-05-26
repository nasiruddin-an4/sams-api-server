
const Batch = require('../models/Batch');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const AcademicCalendar = require('../models/AcademicCalendar');

// ==================== BATCHES ====================

exports.getBatches = async (req, res) => {
  const filter = {};
  if (req.query.departmentId) filter.department = req.query.departmentId;

  // Teachers can only see batches that contain their assigned sections
  if (req.user.role === 'teacher') {
    const sections = await Section.find({ _id: { $in: req.user.assignedSections } }).select('batch');
    const batchIds = [...new Set(sections.map(s => s.batch.toString()))];
    filter._id = { $in: batchIds };
  }

  const batches = await Batch.find(filter).populate('department', 'name').populate('sections').sort('-year');
  res.status(200).json({ success: true, count: batches.length, data: batches });
};

exports.getBatch = async (req, res) => {
  const batch = await Batch.findById(req.params.id).populate('department', 'name').populate('sections');
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
  const batch = await Batch.findById(req.params.id);
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
  await batch.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, data: batch, message: 'Batch moved to trash' });
};

// ==================== SECTIONS ====================

exports.getSections = async (req, res) => {
  const filter = {};
  if (req.query.departmentId) filter.department = req.query.departmentId;
  else if (req.query.classId) filter.department = req.query.classId;
  if (req.query.batchId) filter.batch = req.query.batchId;

  // Teachers can only see assigned sections
  if (req.user.role === 'teacher') {
    filter._id = { $in: req.user.assignedSections };
  }

  const sections = await Section.find(filter)
    .populate('department', 'name')
    .populate('batch', 'name year')
    .populate('teacher', 'name email')
    .sort('name');

  res.status(200).json({ success: true, count: sections.length, data: sections });
};

exports.getSection = async (req, res) => {
  const section = await Section.findById(req.params.id)
    .populate('department', 'name')
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
  const section = await Section.findById(req.params.id);
  if (!section) return res.status(404).json({ success: false, error: 'Section not found' });
  await section.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, data: section, message: 'Section moved to trash' });
};

// ==================== SUBJECTS ====================

exports.getSubjects = async (req, res) => {
  const filter = {};
  if (req.query.departmentId) filter.department = req.query.departmentId;
  else if (req.query.classId) filter.department = req.query.classId;
  if (req.query.type) filter.type = req.query.type;

  // Teachers can only see subjects they are assigned to
  if (req.user.role === 'teacher') {
    const SectionSubjectTeacher = require('../models/SectionSubjectTeacher');
    const assignments = await SectionSubjectTeacher.find({ teacher: req.user.id, isActive: true });
    const subjectIds = [...new Set(assignments.map(a => a.subject.toString()))];
    filter._id = { $in: subjectIds };
  }
  
  const subjects = await Subject.find(filter)
    .populate('department', 'name')
    .sort('code');
  res.status(200).json({ success: true, count: subjects.length, data: subjects });
};

exports.getSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id)
    .populate('department', 'name');
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
  const subject = await Subject.findById(req.params.id);
  if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
  await subject.softDelete(req.user.id, req.body.reason || 'Admin requested deletion');
  res.status(200).json({ success: true, data: subject, message: 'Subject moved to trash' });
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
