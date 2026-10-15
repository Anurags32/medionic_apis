const { randomUUID: uuidv4 } = require('crypto');
const User = require('../models/User');
const callManager = require('../services/callManager');
const { sendIncomingCallFCM, sendCallCancelledFCM, sendMissedCallFCM } = require('../services/fcm');

const userSocketMap = new Map();
const socketUserMap = new Map();
const doctorSocketMap = new Map(); // socket.id -> { userId, doctorId }

/**
 * Helper to dynamically load Doctor model safely
 */
function getDoctorModel() {
  try {
    return require('../models/Doctor');
  } catch (err) {
    return null;
  }
}

/**
 * Register all socket events for a connected client
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {import('socket.io').Socket} socket - Connected socket instance
 */
function registerSocketEvents(io, socket) {
  console.log(`[Socket] User connected: Socket ID = ${socket.id}`);

  socket.on('socket_login', async (data) => {
    const userId = data?.userId;
    if (!userId) {
      console.warn(`[Socket] socket_login failed: userId missing from ${socket.id}`);
      return;
    }
    userSocketMap.set(String(userId), socket.id);
    socketUserMap.set(socket.id, String(userId));

    console.log(`[Socket] Logged in: User ${userId} -> Socket ${socket.id}`);

    // Persist FCM token if provided by client
    if (data?.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.trim()) {
      try {
        const allowedPlatforms = ['android', 'ios', 'web'];
        const platform = allowedPlatforms.includes(data?.platform) ? data.platform : null;
        await User.findByIdAndUpdate(
          userId,
          { fcmToken: data.fcmToken.trim(), fcmPlatform: platform, fcmUpdatedAt: new Date() },
          { runValidators: false }
        );
        console.log(`[Socket] FCM token saved for user ${userId} via socket_login`);
      } catch (e) {
        console.warn(`[Socket] Failed to save FCM token for user ${userId}:`, e.message);
      }
    }

    // Check if user is a doctor
    const Doctor = getDoctorModel();
    let doctorRecord = null;
    if (Doctor) {
      try {
        if (data?.doctorId) {
          doctorRecord = await Doctor.findById(data.doctorId);
        } else if (data?.role === 'doctor' || data?.isDoctor) {
          doctorRecord = await Doctor.findOne({ userId });
        }
      } catch (e) {
        // Ignore DB error during socket login
      }
    }

    if (doctorRecord) {
      doctorSocketMap.set(socket.id, {
        userId: String(userId),
        doctorId: String(doctorRecord._id)
      });

      // If client explicitly sets online or autoOnline flag
      if (data?.setOnline === true || data?.isOnline === true) {
        doctorRecord.isOnline = true;
        doctorRecord.status = 'online';
        doctorRecord.lastOnlineAt = new Date();
        await doctorRecord.save();

        io.emit('doctor_status_updated', {
          doctorId: doctorRecord._id.toString(),
          userId: String(userId),
          fullName: doctorRecord.fullName || `${doctorRecord.firstName} ${doctorRecord.lastName}`,
          isOnline: true,
          status: 'online',
          availability: doctorRecord.availabilityStatus || 'available',
          lastOnlineAt: doctorRecord.lastOnlineAt,
          timestamp: new Date()
        });
      }
    }

    socket.emit('socket_login_success', {
      userId,
      socketId: socket.id,
      isDoctor: !!doctorRecord,
      doctorId: doctorRecord ? doctorRecord._id : undefined,
      message: 'Socket login successful'
    });
  });


  socket.on('socket_logout', async (data) => {
    const userId = data?.userId || socketUserMap.get(socket.id);

    if (userId) {
      userSocketMap.delete(String(userId));
      // Clear FCM token on logout so device stops receiving call push notifications
      try {
        await User.findByIdAndUpdate(
          userId,
          { fcmToken: null, fcmPlatform: null, fcmUpdatedAt: new Date() },
          { runValidators: false }
        );
        console.log(`[Socket] FCM token cleared for user ${userId} on socket_logout`);
      } catch (e) {
        // Non-critical
      }
    }
    socketUserMap.delete(socket.id);

    const docMeta = doctorSocketMap.get(socket.id);
    if (docMeta) {
      doctorSocketMap.delete(socket.id);
      const Doctor = getDoctorModel();
      if (Doctor) {
        try {
          const doc = await Doctor.findByIdAndUpdate(
            docMeta.doctorId,
            { isOnline: false, status: 'offline' },
            { new: true }
          );
          if (doc) {
            io.emit('doctor_status_updated', {
              doctorId: doc._id.toString(),
              userId: doc.userId.toString(),
              fullName: doc.fullName || `${doc.firstName} ${doc.lastName}`,
              isOnline: false,
              status: 'offline',
              availability: doc.availabilityStatus || 'offline',
              lastOnlineAt: doc.lastOnlineAt,
              timestamp: new Date()
            });
          }
        } catch (e) {}
      }
    }

    console.log(`[Socket] Logged out: User ${userId || 'Unknown'} (Socket: ${socket.id})`);

    socket.emit('socket_logout_success', {
      message: 'Socket logout successful'
    });
  });

  // --- DOCTOR ONLINE / OFFLINE STATUS EVENTS ---

  /**
   * Doctor updates online/offline status via socket
   * Payload: { doctorId?, userId?, isOnline: boolean, status?: 'online'|'offline'|'busy', availability?: string }
   */
  const handleDoctorStatusChange = async (payload) => {
    try {
      const { doctorId, userId, isOnline, status, availability } = payload || {};
      const query = doctorId ? { _id: doctorId } : (userId ? { userId } : null);
      if (!query) {
        socket.emit('doctor_status_error', { message: 'doctorId or userId is required' });
        return;
      }

      const updateData = {};
      if (isOnline !== undefined) {
        updateData.isOnline = Boolean(isOnline);
        updateData.status = updateData.isOnline ? 'online' : 'offline';
      }
      if (status !== undefined) {
        updateData.status = status;
        updateData.isOnline = status === 'online';
      }
      if (availability !== undefined && typeof availability === 'string') {
        updateData.availabilityStatus = availability;
      }
      if (updateData.isOnline) {
        updateData.lastOnlineAt = new Date();
      }

      const Doctor = getDoctorModel();
      if (!Doctor) {
        socket.emit('doctor_status_error', { message: 'Doctor model not available' });
        return;
      }

      const updatedDoctor = await Doctor.findOneAndUpdate(query, updateData, { new: true });
      if (!updatedDoctor) {
        socket.emit('doctor_status_error', { message: 'Doctor profile not found' });
        return;
      }

      const eventData = {
        doctorId: updatedDoctor._id.toString(),
        userId: updatedDoctor.userId.toString(),
        fullName: updatedDoctor.fullName || `${updatedDoctor.firstName} ${updatedDoctor.lastName}`,
        isOnline: updatedDoctor.isOnline,
        status: updatedDoctor.status,
        availability: updatedDoctor.availabilityStatus || (updatedDoctor.isOnline ? 'available' : 'offline'),
        lastOnlineAt: updatedDoctor.lastOnlineAt,
        fees: updatedDoctor.fees,
        homeVisitFee: updatedDoctor.homeVisitFee || updatedDoctor.homeFee,
        timestamp: new Date()
      };

      // Broadcast real-time status update to all connected users
      io.emit('doctor_status_updated', eventData);

      // Reply back to sender
      socket.emit('doctor_status_change_success', eventData);
      console.log(`[Socket] Doctor ${updatedDoctor._id} status changed to ${updatedDoctor.status} (online: ${updatedDoctor.isOnline})`);
    } catch (err) {
      console.error('[Socket] doctor_status_change error:', err.message);
      socket.emit('doctor_status_error', { message: err.message });
    }
  };

  socket.on('doctor_set_status', handleDoctorStatusChange);
  socket.on('doctor_status_change', handleDoctorStatusChange);
  socket.on('toggle_doctor_status', handleDoctorStatusChange);

  /**
   * Check status of a specific doctor
   * Payload: { doctorId?, userId? }
   */
  socket.on('get_doctor_status', async (payload) => {
    try {
      const { doctorId, userId } = payload || {};
      const query = doctorId ? { _id: doctorId } : (userId ? { userId } : null);
      if (!query) {
        socket.emit('doctor_status_error', { message: 'doctorId or userId is required' });
        return;
      }

      const Doctor = getDoctorModel();
      if (!Doctor) {
        socket.emit('doctor_status_error', { message: 'Doctor model not available' });
        return;
      }

      const doc = await Doctor.findOne(query).select('isOnline status availabilityStatus lastOnlineAt firstName lastName homeFee homeVisitFee fees');
      if (doc) {
        socket.emit('doctor_status_response', {
          doctorId: doc._id.toString(),
          isOnline: doc.isOnline !== undefined ? doc.isOnline : false,
          status: doc.status || (doc.isOnline ? 'online' : 'offline'),
          availability: doc.availabilityStatus || (doc.isOnline ? 'available' : 'offline'),
          lastOnlineAt: doc.lastOnlineAt,
          homeVisitFee: doc.homeVisitFee || doc.homeFee,
          fees: doc.fees
        });
      } else {
        socket.emit('doctor_status_error', { message: 'Doctor not found' });
      }
    } catch (err) {
      socket.emit('doctor_status_error', { message: err.message });
    }
  });


  const forwardCallEvent = (eventName, payload) => {
    const { fromUserId, toUserId } = payload || {};

    if (!toUserId) {
      console.warn(`[Socket] ${eventName} failed: toUserId missing`, payload);
      return;
    }

    const targetSocketId = userSocketMap.get(String(toUserId));

    if (targetSocketId) {
      io.to(targetSocketId).emit(eventName, payload);
      console.log(`[Socket] ${eventName}: From ${fromUserId} -> To ${toUserId} (Socket: ${targetSocketId})`);
    } else {
      console.log(`[Socket] ${eventName}: User ${toUserId} is offline`);
      socket.emit('call_offline', {
        toUserId,
        eventName,
        message: 'Target user is offline or not registered on socket'
      });
    }
  };

  // --- CALL EVENTS (ZegoCloud + FCM) ---

  /**
   * call_request  →  Generate a unique callID+roomID, forward to receiver via socket
   *                    or FCM push (if receiver is offline).
   *
   * Incoming payload:  { fromUserId, toUserId, callerName?, callerAvatar?, callType? }
   * Outgoing payload:  { ...original, callID, roomID }   (callID & roomID added by server)
   */
  socket.on('call_request', async (payload) => {
    const { fromUserId, toUserId, callerName = '', callerAvatar = '', callType = 'video' } = payload || {};

    if (!toUserId) {
      console.warn('[Socket] call_request failed: toUserId missing', payload);
      return;
    }

    // Generate a server-side callID (also used as roomID)
    const callID = uuidv4();
    const roomID = callID;

    // Enrich payload with server-generated IDs and streamID convention
    // streamID = "<callID>_<userID>" — unique per participant
    const callerStreamID   = `${callID}_${String(fromUserId)}`;
    const receiverStreamID = `${callID}_${String(toUserId)}`;

    const enrichedPayload = {
      ...payload,
      callID,
      roomID,
      callerStreamID,
      receiverStreamID
    };

    // Check if receiver is busy in another call
    if (callManager.isUserBusy(String(toUserId))) {
      socket.emit('call_busy', {
        toUserId,
        fromUserId,
        callID,
        message: 'User is busy in another call'
      });
      console.log(`[Socket] call_request: User ${toUserId} is busy — notifying caller`);
      return;
    }

    // Register call session with 30-second ring timeout
    callManager.createCall(
      { callID, roomID, callerId: String(fromUserId), receiverId: String(toUserId), callType, callerName, callerAvatar },
      async (timedOutSession) => {
        // Ring timeout callback — notify caller of missed call
        const callerSocketId = userSocketMap.get(String(fromUserId));
        if (callerSocketId) {
          io.to(callerSocketId).emit('call_missed', {
            callID,
            roomID,
            toUserId,
            fromUserId,
            message: 'Call not answered'
          });
        }
        // Send FCM missed-call notification to receiver
        try {
          const receiverUser = await User.findById(toUserId).select('fcmToken');
          if (receiverUser?.fcmToken) {
            await sendMissedCallFCM({ fcmToken: receiverUser.fcmToken, callID, callerName, callType });
          }
        } catch (e) {
          console.error('[Socket] Missed-call FCM error:', e.message);
        }
      }
    );

    const receiverSocketId = userSocketMap.get(String(toUserId));

    if (receiverSocketId) {
      // Receiver is online — forward via socket
      io.to(receiverSocketId).emit('call_request', enrichedPayload);
      console.log(`[Socket] call_request: ${fromUserId} → ${toUserId} (Socket: ${receiverSocketId}) callID=${callID}`);
    } else {
      // Receiver is offline — send FCM push notification
      console.log(`[Socket] call_request: User ${toUserId} is offline — sending FCM`);
      try {
        const receiverUser = await User.findById(toUserId).select('fcmToken');
        if (receiverUser?.fcmToken) {
          await sendIncomingCallFCM({
            fcmToken: receiverUser.fcmToken,
            callID,
            roomID,
            callerId: String(fromUserId),
            callerName,
            callerAvatar,
            callType
          });
        } else {
          // No FCM token — let caller know receiver is offline
          socket.emit('call_offline', {
            toUserId,
            fromUserId,
            callID,
            eventName: 'call_request',
            message: 'Target user is offline and has no FCM token'
          });
        }
      } catch (e) {
        console.error('[Socket] FCM call_request error:', e.message);
        socket.emit('call_offline', {
          toUserId,
          fromUserId,
          callID,
          eventName: 'call_request',
          message: 'Target user is offline'
        });
      }
    }

    // Echo enriched payload back to caller: callID, roomID, streamIDs
    socket.emit('call_request_ack', {
      callID,
      roomID,
      toUserId,
      fromUserId,
      callType,
      callerStreamID,
      receiverStreamID
    });
  });

  socket.on('call_accept', (payload) => {
    const { callID, fromUserId, toUserId } = payload || {};
    if (callID) {
      callManager.updateCallStatus(callID, 'accepted');
      // Add streamID convention to the forwarded payload so both sides have it
      const enrichedAccept = {
        ...payload,
        callerStreamID:   callID && toUserId   ? `${callID}_${String(toUserId)}`   : undefined,
        receiverStreamID: callID && fromUserId ? `${callID}_${String(fromUserId)}` : undefined
      };
      forwardCallEvent('call_accept', enrichedAccept);
    } else {
      forwardCallEvent('call_accept', payload);
    }
  });

  socket.on('call_reject', async (payload) => {
    const { callID, fromUserId, toUserId } = payload || {};
    const session = callID ? callManager.getCall(callID) : null;
    if (session) {
      callManager.removeCall(callID);
      // Send FCM to cancel ringing on caller's device
      try {
        const callerUser = await User.findById(session.callerId).select('fcmToken');
        if (callerUser?.fcmToken) {
          await sendCallCancelledFCM({ fcmToken: callerUser.fcmToken, callID, reason: 'call_rejected' });
        }
      } catch (e) {}
    }
    forwardCallEvent('call_reject', payload);
  });


  socket.on('call_busy', (payload) => {
    const { callID } = payload || {};
    if (callID) callManager.removeCall(callID);
    forwardCallEvent('call_busy', payload);
  });

  socket.on('call_end', async (payload) => {
    const { callID } = payload || {};
    const session = callID ? callManager.getCall(callID) : null;
    if (session) {
      callManager.removeCall(callID);
      // Optionally cancel FCM on the other party's device
      try {
        const otherUserId = String(socket.id) === userSocketMap.get(session.callerId)
          ? session.receiverId
          : session.callerId;
        const otherUser = await User.findById(otherUserId).select('fcmToken');
        if (otherUser?.fcmToken) {
          await sendCallCancelledFCM({ fcmToken: otherUser.fcmToken, callID, reason: 'call_ended' });
        }
      } catch (e) {}
    }
    forwardCallEvent('call_end', payload);
  });

  // --- BOOKING EVENTS ---

  /**
   * Driver assigns/accepts booking and relays notification to consumer
   * Payload: { bookingId, consumerId, driverId, driverName, driverPhone, vehicleNumber }
   */
  socket.on('booking_accepted', (payload) => {
    const { bookingId, consumerId, driverId } = payload || {};

    if (!consumerId) {
      console.warn('[Socket] booking_accepted failed: consumerId missing', payload);
      return;
    }

    const targetSocketId = userSocketMap.get(String(consumerId));

    if (targetSocketId) {
      io.to(targetSocketId).emit('booking_accepted', payload);
      console.log(`[Socket] booking_accepted: Driver ${driverId} -> Consumer ${consumerId} (Booking: ${bookingId}, Socket: ${targetSocketId})`);
    } else {
      console.log(`[Socket] booking_accepted: Consumer ${consumerId} is offline`);
      socket.emit('booking_offline', {
        bookingId,
        consumerId,
        eventName: 'booking_accepted',
        message: 'Consumer is offline or not registered on socket'
      });
    }
  });


  socket.on('disconnect', async (reason) => {
    const userId = socketUserMap.get(socket.id);
    if (userId) {
      userSocketMap.delete(userId);
      socketUserMap.delete(socket.id);
      console.log(`[Socket] User ${userId} disconnected (${reason}). Mapping cleaned.`);
    } else {
      console.log(`[Socket] Socket disconnected: ${socket.id} (${reason})`);
    }

    const docMeta = doctorSocketMap.get(socket.id);
    if (docMeta) {
      doctorSocketMap.delete(socket.id);
      const remainingSockets = [...doctorSocketMap.values()].filter(d => d.doctorId === docMeta.doctorId);
      if (remainingSockets.length === 0) {
        const Doctor = getDoctorModel();
        if (Doctor) {
          try {
            const doc = await Doctor.findByIdAndUpdate(
              docMeta.doctorId,
              { isOnline: false, status: 'offline' },
              { new: true }
            );
            if (doc) {
              io.emit('doctor_status_updated', {
                doctorId: doc._id.toString(),
                userId: doc.userId.toString(),
                fullName: doc.fullName || `${doc.firstName} ${doc.lastName}`,
                isOnline: false,
                status: 'offline',
                availability: doc.availabilityStatus || 'offline',
                lastOnlineAt: doc.lastOnlineAt,
                timestamp: new Date()
              });
              console.log(`[Socket] Doctor ${docMeta.doctorId} auto-marked offline on disconnect.`);
            }
          } catch (e) {}
        }
      }
    }
  });
}

/**
 * Utility: Specific user ka socket ID check karne ke liye (agar bahar kisi controller se use karna ho)
 * @param {string} userId
 * @returns {string|undefined}
 */
function getSocketIdByUserId(userId) {
  return userSocketMap.get(String(userId));
}

module.exports = {
  registerSocketEvents,
  userSocketMap,
  getSocketIdByUserId
};
