const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

let io = null;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    console.log('🔌  Socket.io server initialized');

    // Authenticate socket connections via handshake auth token
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
            if (!token) {
                console.warn('⚠️  Socket connection rejected: No token provided');
                return next(new Error('Authentication error: Token required'));
            }

            const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
            const decoded = jwt.verify(token, jwtSecret);

            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                console.warn('⚠️  Socket connection rejected: User not found');
                return next(new Error('Authentication error: User not found'));
            }

            socket.user = user;
            next();
        } catch (error) {
            console.error('⚠️  Socket authentication error:', error.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🟢  Socket connected: User ${socket.user._id} (${socket.user.role})`);

        // Join room (appointment roomId)
        socket.on('join-room', ({ roomId }) => {
            socket.join(roomId);
            console.log(`🚪  User ${socket.user._id} joined room ${roomId}`);
            socket.to(roomId).emit('user-joined', { userId: socket.user._id, role: socket.user.role });
        });

        // Send chat message
        socket.on('send-message', async ({ roomId, text }) => {
            try {
                if (!roomId || !text) return;

                console.log(`💬  Message from ${socket.user._id} to room ${roomId}: "${text}"`);

                const senderRole = socket.user.role === 'doctor' ? 'doctor' : 'patient';

                // Persist to Database first
                const message = await Message.create({
                    roomId,
                    senderId: socket.user._id,
                    senderRole,
                    text
                });

                // Broadcast to room (including sender)
                io.to(roomId).emit('receive-message', {
                    messageId: message._id,
                    roomId: message.roomId,
                    text: message.text,
                    senderId: message.senderId,
                    senderRole: message.senderRole,
                    createdAt: message.createdAt
                });
            } catch (error) {
                console.error('❌  Error saving/broadcasting socket message:', error.message);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // WebRTC Signaling relays
        socket.on('video-offer', ({ sdp, roomId }) => {
            console.log(`📹  Relaying video offer in room ${roomId}`);
            socket.to(roomId).emit('video-offer', { sdp, roomId });
        });

        socket.on('video-answer', ({ sdp, roomId }) => {
            console.log(`📹  Relaying video answer in room ${roomId}`);
            socket.to(roomId).emit('video-answer', { sdp, roomId });
        });

        socket.on('ice-candidate', ({ candidate, roomId }) => {
            console.log(`❄️   Relaying ICE candidate in room ${roomId}`);
            socket.to(roomId).emit('ice-candidate', { candidate, roomId });
        });

        // Disconnect handling
        socket.on('disconnect', () => {
            console.log(`🔴  Socket disconnected: User ${socket.user._id}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = {
    initSocket,
    getIO
};
