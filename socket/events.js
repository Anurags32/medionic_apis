
const userSocketMap = new Map();
const socketUserMap = new Map();

/**
 * Register all socket events for a connected client
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {import('socket.io').Socket} socket - Connected socket instance
 */
function registerSocketEvents(io, socket) {
  console.log(`[Socket] User connected: Socket ID = ${socket.id}`);

  socket.on('socket_login', (data) => {
    const userId = data?.userId;
    if (!userId) {
      console.warn(`[Socket] socket_login failed: userId missing from ${socket.id}`);
      return;
    }
    userSocketMap.set(String(userId), socket.id);
    socketUserMap.set(socket.id, String(userId));

    console.log(`[Socket] Logged in: User ${userId} -> Socket ${socket.id}`);

    socket.emit('socket_login_success', {
      userId,
      socketId: socket.id,
      message: 'Socket login successful'
    });
  });


  socket.on('socket_logout', (data) => {
    const userId = data?.userId || socketUserMap.get(socket.id);

    if (userId) {
      userSocketMap.delete(String(userId));
    }
    socketUserMap.delete(socket.id);

    console.log(`[Socket] Logged out: User ${userId || 'Unknown'} (Socket: ${socket.id})`);

    socket.emit('socket_logout_success', {
      message: 'Socket logout successful'
    });
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

  socket.on('call_request', (payload) => {
    forwardCallEvent('call_request', payload);
  });

  socket.on('call_accept', (payload) => {
    forwardCallEvent('call_accept', payload);
  });

  socket.on('call_reject', (payload) => {
    forwardCallEvent('call_reject', payload);
  });


  socket.on('call_busy', (payload) => {
    forwardCallEvent('call_busy', payload);
  });

  socket.on('call_end', (payload) => {
    forwardCallEvent('call_end', payload);
  });


  socket.on('disconnect', (reason) => {
    const userId = socketUserMap.get(socket.id);
    if (userId) {
      userSocketMap.delete(userId);
      socketUserMap.delete(socket.id);
      console.log(`[Socket] User ${userId} disconnected (${reason}). Mapping cleaned.`);
    } else {
      console.log(`[Socket] Socket disconnected: ${socket.id} (${reason})`);
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
