const { getMessaging } = require('../config/firebase');

/**
 * Send a data-only FCM push notification for ZegoCloud incoming call invitations.
 * 
 * Note: Data-only messages (without top-level 'notification' block) allow the app
 * to wake up in background/killed state on both Android and iOS to trigger CallKit /
 * full-screen incoming call UI.
 *
 * @param {Object} params
 * @param {string} params.fcm_token 
 * @param {string} params.title 
 * @param {string} params.body 
 * @param {Object} params.data 
 * @returns {Promise<string>} 
 */
const sendCallNotification = async ({ fcm_token, title, body, data = {} }) => {
  const messaging = getMessaging();

  const stringifiedData = {};

  if (title) stringifiedData.title = String(title);
  if (body) stringifiedData.body = String(body);
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }
  }

  if (!stringifiedData.type) {
    stringifiedData.type = 'call_invite';
  }

  const message = {
    token: fcm_token,
    data: stringifiedData,
    android: {
      priority: 'high'
    },
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

    throw error;
  }
};

module.exports = {
  sendCallNotification
};
