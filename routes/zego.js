/**
 * routes/zego.js
 *
 * ZegoCloud Token04 endpoint — server-authoritative token generation.
 *
 * Security rules enforced here:
 *  1. JWT authentication required (protect middleware).
 *  2. callID must correspond to an active call in callManager (in-memory Map).
 *  3. Requesting user must be the caller OR the receiver of that call.
 *  4. Call status must be 'accepted' — tokens are NOT issued for ringing/missed/ended calls.
 *  5. appID is returned to client; ZEGO_SERVER_SECRET is NEVER returned.
 *  6. roomID = callID (server convention, not supplied by client).
 *  7. streamID = "<callID>_<userID>" — computed server-side, returned to client.
 *
 * Routes:
 *   POST /api/zego/token   { callID }
 *   GET  /api/zego/token?callID=<id>    (convenience alias)
 */

const express = require('express');
const router  = express.Router();
const { protect }       = require('../middleware/auth');
const { generateToken04 } = require('../services/zegoToken');
const callManager         = require('../services/callManager');

// ─────────────────────────────────────────────────────────────────────────────
// Shared handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleTokenRequest(req, res) {
  try {
    // 1. Extract callID from body (POST) or query (GET)
    const callID = (req.body?.callID || req.query?.callID || '').trim();
    if (!callID) {
      return res.status(400).json({
        result: 'F',
        status: '1',
        Message: 'callID is required',
        JSONData: []
      });
    }

    // 2. Lookup call session from in-memory map
    const session = callManager.getCall(callID);
    if (!session) {
      return res.status(404).json({
        result: 'F',
        status: '1',
        Message: 'Call session not found or already expired',
        JSONData: []
      });
    }

    // 3. Requesting user must be caller or receiver
    const requestingUserId = String(req.user._id);
    const isParticipant    =
      requestingUserId === String(session.callerId) ||
      requestingUserId === String(session.receiverId);

    if (!isParticipant) {
      return res.status(403).json({
        result: 'F',
        status: '1',
        Message: 'You are not a participant of this call',
        JSONData: []
      });
    }

    // 4. Token only issued after call is accepted
    //    (prevents token farming on unanswered calls)
    if (session.status !== 'accepted') {
      return res.status(403).json({
        result: 'F',
        status: '1',
        Message: `Token cannot be issued: call status is '${session.status}'. Token is only available after the call is accepted.`,
        JSONData: []
      });
    }

    // 5. Generate Token04 scoped to this room
    const roomID   = callID;  // convention: roomID === callID
    const streamID = `${callID}_${requestingUserId}`;  // unique per participant

    const { token, appID, expireTime } = generateToken04({
      userId: requestingUserId,
      roomID,
      effectiveTimeInSeconds: 3600
    });

    console.log(`[Zego Token] Issued for user ${requestingUserId}, callID=${callID}, expires=${expireTime}`);

    // 6. Return token — NEVER include ZEGO_SERVER_SECRET
    return res.status(200).json({
      result: 'S',
      status: '0',
      Message: 'Zego token generated successfully',
      JSONData: [{
        appID,
        token,
        roomID,
        streamID,
        expiresIn: 3600,
        expireTime
      }]
    });

  } catch (error) {
    console.error('[Zego Token] Error:', error.message);

    const statusCode = error.message.includes('ZEGO_')   ? 500
      : error.message.includes('missing')                ? 500
      : 500;

    return res.status(statusCode).json({
      result: 'F',
      status: '1',
      Message: error.message || 'Failed to generate Zego token',
      JSONData: []
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes — both GET and POST so clients can choose
// ─────────────────────────────────────────────────────────────────────────────

router.post('/token', protect, handleTokenRequest);
router.get('/token',  protect, handleTokenRequest);

module.exports = router;
