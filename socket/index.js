const { Server } = require('socket.io');
const { registerSocketEvents, getSocketIdByUserId, userSocketMap } = require('./events');

let io = null;

/**
 * Socket.IO Initialization Function
 * 
 * @param {import('http').Server | import('https').Server} server - HTTP/HTTPS server instance
 * @param {object} [customOptions] - Optional Socket.IO configuration overrides
 * @returns {import('socket.io').Server} - Socket.IO instance
 */
function initSocket(server, customOptions = {}) {

  if (io) {
    return io;
  }
  const defaultOptions = {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  };

  const options = { ...defaultOptions, ...customOptions };

  io = new Server(server, options);

  io.on('connection', (socket) => {
    registerSocketEvents(io, socket);
  });

  console.log('[Socket] Socket.IO server initialized successfully.');

  return io;
}

/**
 * Get the initialized Socket.IO instance anywhere across the app
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO is not initialized! Call initSocket(server) first.');
  }
  return io;
}

module.exports = initSocket;
module.exports.initSocket = initSocket;
module.exports.getIO = getIO;
module.exports.getSocketIdByUserId = getSocketIdByUserId;
module.exports.userSocketMap = userSocketMap;
