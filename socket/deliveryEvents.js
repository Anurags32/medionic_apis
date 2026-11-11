let ioInstance = null;

/**
 * Initializes delivery socket event handlers and sets io instance
 */
function initDeliverySocket(io) {
    ioInstance = io;

    io.on('connection', (socket) => {
        // Authenticated room joining
        socket.on('join_delivery_room', ({ room, token }) => {
            if (!room) return;
            // Room format validation: partner:ID, pharmacy:ID, consumer:ID, delivery:ID
            const [prefix, id] = room.split(':');
            if (['partner', 'pharmacy', 'consumer', 'delivery'].includes(prefix) && id) {
                socket.join(room);
                socket.emit('joined_delivery_room', { room, success: true });
            } else {
                socket.emit('error', { message: 'Invalid room format' });
            }
        });

        socket.on('leave_delivery_room', ({ room }) => {
            if (room) {
                socket.leave(room);
                socket.emit('left_delivery_room', { room, success: true });
            }
        });
    });

    console.log('[Socket] Delivery Socket subsystem initialized.');
}

/**
 * Emits an event to a specific delivery room or globally
 */
function emitDeliveryEvent(room, eventName, payload) {
    if (!ioInstance) return;
    try {
        if (room) {
            ioInstance.to(room).emit(eventName, payload);
        } else {
            ioInstance.emit(eventName, payload);
        }
    } catch (err) {
        console.warn(`[Socket-Delivery] Emit error for ${eventName}:`, err.message);
    }
}

function getDeliveryIO() {
    return ioInstance;
}

module.exports = {
    initDeliverySocket,
    emitDeliveryEvent,
    getDeliveryIO,
};

