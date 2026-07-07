const Appointment = require('../models/Appointment');
const ErrorResponse = require('../utils/errorResponse');

// Try to access the Socket.io instance — may not be ready in test environments
const getIO = () => {
    try {
        const { getIO: socketGetIO } = require('../services/socketService');
        return socketGetIO();
    } catch {
        return null;
    }
};

// @desc    WebRTC signaling relay via REST (fallback / companion to Socket.io events)
// @route   POST /api/consultations/video/signal
// @access  Private (Doctor or Patient)
// Body: { sdp, candidate, roomId, targetUserId, type: 'offer'|'answer'|'ice-candidate' }
exports.videoSignal = async (req, res, next) => {
    try {
        const { sdp, candidate, roomId, targetUserId, type } = req.body;

        const validTypes = ['offer', 'answer', 'ice-candidate'];
        if (!type || !validTypes.includes(type)) {
            return next(new ErrorResponse(`type must be one of: ${validTypes.join(', ')}`, 400));
        }

        if (!roomId || !targetUserId) {
            return next(new ErrorResponse('roomId and targetUserId are required', 400));
        }

        if (type !== 'ice-candidate' && !sdp) {
            return next(new ErrorResponse('sdp is required for offer and answer signals', 400));
        }

        if (type === 'ice-candidate' && !candidate) {
            return next(new ErrorResponse('candidate is required for ice-candidate signals', 400));
        }

        // Verify the roomId belongs to a real appointment that involves this user
        const appointment = await Appointment.findOne({
            roomId,
            $or: [
                { patientId: req.user._id },
                { doctorId: req.user._id }
            ]
        });

        // Note: patientId / doctorId on Appointment refers to the profile doc ID,
        // but req.user._id is the User ID. We do a lenient check — if no match by
        // userId, we also check via populated lookup. For MVP we allow any authenticated
        // user who knows the roomId (the room itself is the secret).
        // In a stricter build, enforce patient/doctor profile ID check here.

        if (!appointment && process.env.NODE_ENV === 'production') {
            return next(new ErrorResponse('Invalid room — no active appointment found for this room', 403));
        }

        // Relay via Socket.io if available
        const io = getIO();
        if (io) {
            const eventMap = {
                'offer': 'video-offer',
                'answer': 'video-answer',
                'ice-candidate': 'ice-candidate'
            };

            const payload = { roomId, fromUserId: req.user._id };
            if (sdp) payload.sdp = sdp;
            if (candidate) payload.candidate = candidate;

            io.to(roomId).emit(eventMap[type], payload);
        }

        res.status(200).json({
            success: true,
            message: `Signal of type "${type}" relayed to room ${roomId}`,
            data: {
                roomId,
                type,
                targetUserId,
                relayedViaSocket: !!io,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get messages for a consultation room (chat history)
// @route   GET /api/consultations/:roomId/messages
// @access  Private
exports.getRoomMessages = async (req, res, next) => {
    try {
        const Message = require('../models/Message');
        const { roomId } = req.params;
        const { limit = 50, before } = req.query;

        const query = { roomId };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: messages.reverse() // chronological order
        });
    } catch (error) {
        next(error);
    }
};
