/**
 * fcm.js  (services/fcm.js)
 * 
 * Thin wrapper around the existing fcmService.js that adds:
 *  - sendIncomingCallFCM   → data-only, high-priority FCM for incoming call
 *  - sendCallCancelledFCM  → data-only FCM to dismiss ringing notification
 *  - sendMissedCallFCM     → data-only FCM after ring timeout
 *  - sendGenericFCM        → generic helper
 *
 * All functions are fire-and-forget safe (they swallow non-critical errors).
 */

const { sendCallNotification } = require('./fcmService');

/**
 * Send a high-priority data-only FCM so the receiver's app/VoIP layer
 * can show the native incoming-call screen even when the app is killed.
 *
 * @param {object} params
 * @param {string} params.fcmToken
 * @param {string} params.callID
 * @param {string} params.roomID
 * @param {string} params.callerId
 * @param {string} params.callerName
 * @param {string} [params.callerAvatar]
 * @param {string} [params.callType]   'video' | 'audio'
 */
async function sendIncomingCallFCM({ fcmToken, callID, roomID, callerId, callerName, callerAvatar = '', callType = 'video' }) {
  if (!fcmToken) return;
  try {
    await sendCallNotification({
      fcm_token: fcmToken,
      title: callerName || 'Incoming Call',
      body: callType === 'video' ? `${callerName || 'Someone'} is calling you (Video)` : `${callerName || 'Someone'} is calling you (Audio)`,
      data: {
        type: 'incoming_call',
        callID,
        roomID,
        callerId,
        callerName: callerName || '',
        callerAvatar: callerAvatar || '',
        callType
      }
    });
    console.log(`[FCM] incoming_call sent to token ...${fcmToken.slice(-8)} for call ${callID}`);
  } catch (err) {
    console.error(`[FCM] sendIncomingCallFCM error (callID=${callID}):`, err.message);
  }
}

/**
 * Send an FCM to dismiss the ringing notification on the receiver's device.
 * Used when: caller cancels before pick-up, or receiver rejects.
 *
 * @param {object} params
 * @param {string} params.fcmToken
 * @param {string} params.callID
 * @param {'call_rejected'|'call_cancelled'|'call_ended'} [params.reason]
 */
async function sendCallCancelledFCM({ fcmToken, callID, reason = 'call_cancelled' }) {
  if (!fcmToken) return;
  try {
    await sendCallNotification({
      fcm_token: fcmToken,
      title: reason === 'call_rejected' ? 'Call Declined' : 'Call Ended',
      body: reason === 'call_rejected' ? 'The call was declined.' : 'The call has ended.',
      data: {
        type: reason,
        callID
      }
    });
    console.log(`[FCM] ${reason} sent to token ...${fcmToken.slice(-8)} for call ${callID}`);
  } catch (err) {
    console.error(`[FCM] sendCallCancelledFCM error (callID=${callID}):`, err.message);
  }
}

/**
 * Send a "Missed call" FCM after ring timeout.
 *
 * @param {object} params
 * @param {string} params.fcmToken
 * @param {string} params.callID
 * @param {string} params.callerName
 * @param {string} [params.callType]
 */
async function sendMissedCallFCM({ fcmToken, callID, callerName, callType = 'video' }) {
  if (!fcmToken) return;
  try {
    await sendCallNotification({
      fcm_token: fcmToken,
      title: 'Missed Call',
      body: `You missed a ${callType} call from ${callerName || 'someone'}.`,
      data: {
        type: 'call_missed',
        callID,
        callerName: callerName || '',
        callType
      }
    });
    console.log(`[FCM] call_missed sent to token ...${fcmToken.slice(-8)} for call ${callID}`);
  } catch (err) {
    console.error(`[FCM] sendMissedCallFCM error (callID=${callID}):`, err.message);
  }
}

module.exports = {
  sendIncomingCallFCM,
  sendCallCancelledFCM,
  sendMissedCallFCM
};
