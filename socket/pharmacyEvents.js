const { Server } = require('socket.io');
const { verifyAccessToken } = require('../config/pharmacyJwt');
const { User } = require('../models/pharmacy');


let io = null;
const presenceMap = new Map();

const initSocket = (httpServerOrIO) => {
    if (httpServerOrIO && (httpServerOrIO.sockets || typeof httpServerOrIO.emit === 'function')) {
        io = httpServerOrIO;
    } else {
        io = new Server(httpServerOrIO, {
            cors: {
                origin: process.env.CORS_ORIGIN?.split(',') || '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
        });
    }

    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                socket.handshake.query?.token;

            // If no token is provided, pass through so general/WebRTC clients can connect
            if (!token) {
                return next();
            }

            const decoded = verifyAccessToken(token);
            if (!decoded || !decoded.userId) {
                // If token was provided but invalid for pharmacy staff, still allow connection for non-staff
                return next();
            }


            const user = await User.findById(decoded.userId);
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            if (user.is_blocked || !user.is_active) {
                return next(new Error('Authentication error: User account restricted'));
            }

            if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.token_version) {
                return next(new Error('Authentication error: Session invalidated'));
            }

            socket.user = {
                id: user._id.toString(),
                branchId: user.branch_id.toString(),
                role: user.role,
                fullName: user.full_name,
                email: user.email,
            };

            next();
        } catch (err) {
            return next(new Error('Authentication error: ' + err.message));
        }
    });

    io.on('connection', async (socket) => {
        const user = socket.user;
        if (!user) return;

        socket.join(`branch_${user.branchId}`);
        socket.join(`user_${user.id}`);

        const currentPresence = presenceMap.get(user.id) || {
            connectionCount: 0,
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
            branchId: user.branchId,
            isOnline: false,
            lastSeen: new Date(),
        };

        currentPresence.connectionCount += 1;
        currentPresence.isOnline = true;
        currentPresence.lastSeen = new Date();
        presenceMap.set(user.id, currentPresence);

        User.updateOne({ _id: user.id }, { is_online: true, last_seen_at: new Date() }).catch(() => {});

        if (currentPresence.connectionCount === 1) {
            emitToBranch(user.branchId, 'staff:online', {
                staffId: user.id,
                name: user.fullName,
                role: user.role,
                timestamp: new Date().toISOString(),
                isOnline: true,
            });
        }

        socket.on('staff:location_update', (locationData) => {
            const { latitude, longitude, address } = locationData || {};
            if (latitude && longitude) {
                User.updateOne(
                    { _id: user.id },
                    {
                        current_location: {
                            latitude: parseFloat(latitude),
                            longitude: parseFloat(longitude),
                            address: address || '',
                            updated_at: new Date(),
                        },
                    }
                ).catch(() => {});
            }
            emitToBranch(user.branchId, 'staff:location_broadcast', {
                staffId: user.id,
                name: user.fullName,
                role: user.role,
                latitude,
                longitude,
                address,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('staff:duty_toggle', async (dutyData) => {
            const { duty_status, latitude, longitude, address } = dutyData || {};
            const nextStatus = duty_status === 'ON_DUTY' ? 'ON_DUTY' : 'OFF_DUTY';
            const updateObj = {
                duty_status: nextStatus,
                last_duty_toggle_at: new Date(),
            };
            if (latitude && longitude) {
                updateObj.current_location = {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    address: address || '',
                    updated_at: new Date(),
                };
            }

            User.updateOne({ _id: user.id }, updateObj).catch(() => {});

            emitToBranch(user.branchId, 'staff:duty_changed', {
                staffId: user.id,
                name: user.fullName,
                role: user.role,
                duty_status: nextStatus,
                latitude,
                longitude,
                address,
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('disconnect', () => {
            const presence = presenceMap.get(user.id);
            if (presence) {
                presence.connectionCount = Math.max(0, presence.connectionCount - 1);
                presence.lastSeen = new Date();

                if (presence.connectionCount === 0) {
                    presence.isOnline = false;
                    presenceMap.set(user.id, presence);

                    User.updateOne({ _id: user.id }, { is_online: false, last_seen_at: new Date() }).catch(() => {});

                    emitToBranch(user.branchId, 'staff:offline', {
                        staffId: user.id,
                        name: user.fullName,
                        timestamp: new Date().toISOString(),
                        isOnline: false,
                    });
                } else {
                    presenceMap.set(user.id, presence);
                }
            }
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        return {
            to: () => ({ emit: () => {} }),
            emit: () => {},
        };
    }
    return io;
};

const emitToBranch = (branchId, eventName, data) => {
    const socketInstance = getIO();
    socketInstance.to(`branch_${branchId}`).emit(eventName, data);
};

const emitToUser = (userId, eventName, data) => {
    const socketInstance = getIO();
    socketInstance.to(`user_${userId}`).emit(eventName, data);
};

const getOnlineStatusMap = (branchId) => {
    const result = {};
    for (const [userId, presence] of presenceMap.entries()) {
        if (presence.branchId === branchId) {
            result[userId] = {
                isOnline: presence.isOnline,
                lastSeen: presence.lastSeen,
            };
        }
    }
    return result;
};

module.exports = {
    initSocket,
    getIO,
    emitToBranch,
    emitToUser,
    getOnlineStatusMap,
};
