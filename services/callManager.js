/**
 * callManager.js
 * In-memory Map to track active calls.
 * Structure: callID → { callerId, receiverId, status, startedAt, callerName, callerAvatar, callType, roomID, ringTimer }
 *
 * Status values: 'ringing' | 'accepted' | 'ended' | 'missed' | 'rejected'
 */

const RING_TIMEOUT_MS = 30_000; // 30 seconds

/** @type {Map<string, import('./callManager').CallSession>} */
const activeCalls = new Map();

/**
 * Create a new call session and start the ring timeout.
 * @param {object} params
 * @param {string} params.callID
 * @param {string} params.roomID
 * @param {string} params.callerId
 * @param {string} params.receiverId
 * @param {string} [params.callType]
 * @param {string} [params.callerName]
 * @param {string} [params.callerAvatar]
 * @param {Function} onTimeout - Async callback called when ring timeout fires.
 * @returns {object} The new call session
 */
function createCall({ callID, roomID, callerId, receiverId, callType = 'video', callerName = '', callerAvatar = '' }, onTimeout) {
  // Clear any stale session
  if (activeCalls.has(callID)) {
    clearCallTimeout(callID);
  }

  const session = {
    callID,
    roomID,
    callerId,
    receiverId,
    callType,
    callerName,
    callerAvatar,
    status: 'ringing',
    startedAt: new Date(),
    ringTimer: null
  };

  const timer = setTimeout(async () => {
    const s = activeCalls.get(callID);
    if (s && s.status === 'ringing') {
      s.status = 'missed';
      console.log(`[CallManager] Call ${callID} timed out — marking missed`);
      if (typeof onTimeout === 'function') {
        try {
          await onTimeout(s);
        } catch (err) {
          console.error('[CallManager] Ring timeout callback error:', err.message);
        }
      }
      activeCalls.delete(callID);
    }
  }, RING_TIMEOUT_MS);

  session.ringTimer = timer;
  activeCalls.set(callID, session);
  console.log(`[CallManager] Call created: ${callID} | ${callerId} → ${receiverId} (${callType})`);
  return session;
}

/**
 * Update the status of an active call.
 * @param {string} callID
 * @param {'accepted'|'ended'|'missed'|'rejected'} newStatus
 * @returns {object|null}
 */
function updateCallStatus(callID, newStatus) {
  const session = activeCalls.get(callID);
  if (!session) return null;
  session.status = newStatus;
  if (['accepted', 'ended', 'missed', 'rejected'].includes(newStatus)) {
    clearCallTimeout(callID);
  }
  console.log(`[CallManager] Call ${callID} status → ${newStatus}`);
  return session;
}

/**
 * Get an active call session.
 * @param {string} callID
 * @returns {object|null}
 */
function getCall(callID) {
  return activeCalls.get(callID) || null;
}

/**
 * Delete a call and clear its timer.
 * @param {string} callID
 */
function removeCall(callID) {
  clearCallTimeout(callID);
  activeCalls.delete(callID);
}

/**
 * Clear the ring timer for a call.
 * @param {string} callID
 */
function clearCallTimeout(callID) {
  const session = activeCalls.get(callID);
  if (session && session.ringTimer) {
    clearTimeout(session.ringTimer);
    session.ringTimer = null;
  }
}

/**
 * Check if a user is already in an active (ringing/accepted) call.
 * @param {string} userId
 * @returns {boolean}
 */
function isUserBusy(userId) {
  for (const session of activeCalls.values()) {
    if (
      (session.callerId === String(userId) || session.receiverId === String(userId)) &&
      ['ringing', 'accepted'].includes(session.status)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Get all active sessions (for debugging).
 * @returns {Array}
 */
function listActiveCalls() {
  return [...activeCalls.entries()].map(([id, s]) => ({
    callID: id,
    callerId: s.callerId,
    receiverId: s.receiverId,
    status: s.status,
    callType: s.callType,
    startedAt: s.startedAt
  }));
}

module.exports = {
  createCall,
  updateCallStatus,
  getCall,
  removeCall,
  isUserBusy,
  listActiveCalls,
  RING_TIMEOUT_MS
};
