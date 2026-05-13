const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('./firebaseService');

// Redis connection - defaults to localhost:6379
let isRedisConnected = false;

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times) => {
    // Only retry every 30 seconds if it fails, to avoid console spam
    return Math.min(times * 50, 30000);
  }
});

connection.on('connect', () => {
  isRedisConnected = true;
  console.log(`✅ Redis Connected: ${process.env.REDIS_HOST || 'localhost'}`);
});

connection.on('error', (err) => {
  isRedisConnected = false;
  if (err.code === 'ECONNREFUSED') {
    console.warn(`⚠️ Redis not found at ${process.env.REDIS_HOST || 'localhost'}. Notification queue is disabled.`);
  } else {
    console.error('❌ Redis Error:', err.message);
  }
});

// Create Queue
const notificationQueue = new Queue('notifications', { connection });

// Background Worker to process jobs
const notificationWorker = new Worker('notifications', async job => {
  const { recipients, title, body, type, referenceId } = job.data;

  // 1. Fetch recipient users to get their FCM tokens
  const users = await User.find({ _id: { $in: recipients } }).select('_id fcmTokens');
  
  const fcmTokens = [];
  const notificationDocs = [];

  for (const user of users) {
    if (user.fcmTokens && user.fcmTokens.length > 0) {
      fcmTokens.push(...user.fcmTokens);
    }
    
    // Save to MongoDB so it shows up in their in-app notifications center
    notificationDocs.push({
      recipient: user._id,
      title,
      body,
      type,
      referenceId
    });
  }

  // 2. Save in-app notifications
  if (notificationDocs.length > 0) {
    await Notification.insertMany(notificationDocs);
  }

  // 3. Send Push Notification via Firebase
  if (fcmTokens.length > 0) {
    await sendPushNotification(fcmTokens, title, body, { type, referenceId: String(referenceId) });
  }

  return { success: true, processedCount: notificationDocs.length };

}, { connection });

notificationWorker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} has failed with ${err.message}`);
});

/**
 * Helper to enqueue a notification job
 * @param {Array<string>} recipientIds - Array of User IDs (e.g. parents, students)
 * @param {String} title - Notification title
 * @param {String} body - Notification body text
 * @param {String} type - 'attendance', 'exam', 'fine', 'notice'
 * @param {String} referenceId - Optional related document ID
 */
const enqueueNotification = async (recipientIds, title, body, type = 'general', referenceId = null) => {
  if (!recipientIds || recipientIds.length === 0) return;
  
  if (!isRedisConnected) {
    console.warn(`⚠️ Redis disconnected. Skipping notification: ${title}`);
    // Optional: Process synchronously here if absolutely necessary, 
    // but usually, we just want to avoid the crash.
    return;
  }
  
  await notificationQueue.add('send-notification', {
    recipients: recipientIds,
    title,
    body,
    type,
    referenceId
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
};

module.exports = {
  notificationQueue,
  enqueueNotification
};
