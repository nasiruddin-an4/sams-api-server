const admin = require('firebase-admin');

// Ensure you replace this with your actual service account key later.
// For now, it will safely initialize without credentials for development testing.
// In production: admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

let isFirebaseInitialized = false;

try {
  // If the env variable GOOGLE_APPLICATION_CREDENTIALS is set, it will auto-initialize
  // Otherwise, we wrap it in a try-catch so the app doesn't crash in dev mode without keys.
  if (!admin.apps.length) {
    admin.initializeApp();
    isFirebaseInitialized = true;
  }
} catch (error) {
  console.warn('Firebase Admin initialization skipped: GOOGLE_APPLICATION_CREDENTIALS not found.');
}

const sendPushNotification = async (fcmTokens, title, body, data = {}) => {
  if (!isFirebaseInitialized || !fcmTokens || fcmTokens.length === 0) {
    console.log(`[Push Notification Mock] Title: "${title}", Body: "${body}", Tokens: ${fcmTokens?.length || 0}`);
    return;
  }

  const message = {
    notification: { title, body },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // standard for flutter apps
    },
    tokens: fcmTokens,
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(fcmTokens[idx]);
        }
      });
      console.error('List of tokens that caused failures: ' + failedTokens);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

module.exports = {
  sendPushNotification
};
