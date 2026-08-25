const Appointment = require('../models/Appointment');
const ErrorResponse = require('../utils/errorResponse');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const ConsultationRoom = require('../models/ConsultationRoom');
const { ensureConsultationRoom } = require('../services/consultationRoomService');

exports.getConsultationSession = async (req, res, next) => {
    try {
        const appointment = await Appointment.findById(req.params.appointmentId);
        if (!appointment) return next(new ErrorResponse('Appointment not found', 404));

        const [patient, doctor] = await Promise.all([
            Patient.findOne({ userId: req.user._id }).select('_id'),
            Doctor.findOne({ userId: req.user._id }).select('_id')
        ]);
        const authorized = (patient && appointment.patientId.equals(patient._id)) ||
            (doctor && appointment.doctorId.equals(doctor._id));
        if (!authorized) return next(new ErrorResponse('Not authorized to access this consultation', 403));

        const room = await ensureConsultationRoom(appointment);
        if (!room) return next(new ErrorResponse('Consultation room is not available for this appointment', 409));

        res.status(200).json({
            success: true,
            data: {
                roomId: room.roomId,
                appointmentId: room.appointmentId,
                joinFrom: room.joinFrom,
                joinUntil: room.joinUntil,
                state: room.state
            },
            requestId: req.requestId
        });
    } catch (error) {
        next(error);
    }
};

const getIO = () => {
    try {
        const { getIO: socketGetIO } = require('../services/socketService');
        return socketGetIO();
    } catch {
        return null;
    }
};


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

        const [patient, doctor] = await Promise.all([
            Patient.findOne({ userId: req.user._id }).select('_id'),
            Doctor.findOne({ userId: req.user._id }).select('_id')
        ]);
        const participantIds = [patient?._id, doctor?._id].filter(Boolean);
        const room = await ConsultationRoom.findOne({ roomId });
        const appointment = room && await Appointment.findOne({
            _id: room.appointmentId,
            roomId,
            status: { $in: ['confirmed', 'in_progress'] },
            $or: participantIds.map(id => ({ patientId: id })).concat(participantIds.map(id => ({ doctorId: id })))
        });

        if (!appointment) {
            return next(new ErrorResponse('Invalid room — no active appointment found for this room', 403));
        }

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
            data: messages.reverse()
        });
    } catch (error) {
        next(error);
    }
};
