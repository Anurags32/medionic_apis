const { getMessaging } = require('../config/firebase');

/**
 * Send a data-only FCM push notification for ZegoCloud incoming call invitations.
 * 
 * Note: Data-only messages (without top-level 'notification' block) allow the app
 * to wake up in background/killed state on both Android and iOS to trigger CallKit /
 * full-screen incoming call UI.
 *
 * @param {Object} params
 * @param {string} params.fcm_token - Target device FCM registration token
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} params.data - Custom call payload (call_id, caller_name, etc.)
 * @returns {Promise<string>} Firebase message ID
 */
const sendCallNotification = async ({ fcm_token, title, body, data = {} }) => {
  const messaging = getMessaging();

  // FCM data payloads only support string key-value pairs
  const stringifiedData = {};

  // Include title & body inside data payload so client can read them even in background
  if (title) stringifiedData.title = String(title);
  if (body) stringifiedData.body = String(body);

  // Convert all data object properties to string
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }
  }

  // Ensure mandatory defaults for call invite if not explicitly passed
  if (!stringifiedData.type) {
    stringifiedData.type = 'call_invite';
  }

  const message = {
    token: fcm_token,
    data: stringifiedData,
    // Android: High priority for instant wake-up & heads-up/CallKit display during Doze mode
    android: {
      priority: 'high'
    },
    // iOS: Background wake-up (content-available: 1) and immediate priority (apns-priority: 10)
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          contentAvailable: true
        }
      }
    }
  };

  try {
    const response = await messaging.send(message);
    return response;
  } catch (error) {
    console.error('❌ FCM send error:', error);

    // Map common FCM error codes to human-readable error messages
    if (error.code === 'messaging/registration-token-not-registered') {
      const err = new Error('Invalid or expired FCM registration token (device unregistered)');
      err.statusCode = 400;
      err.fcmCode = error.code;
      throw err;
    } else if (error.code === 'messaging/invalid-registration-token') {
      const err = new Error('Malformed or invalid FCM registration token format');
      err.statusCode = 400;
      err.fcmCode = error.code;
      throw err;
    } else if (error.code === 'messaging/invalid-argument') {
      const err = new Error(`Invalid FCM message payload: ${error.message}`);
      err.statusCode = 400;
      err.fcmCode = error.code;
      throw err;
    }

    // Re-throw general errors
    throw error;
  }
};

module.exports = {
  sendCallNotification
};
