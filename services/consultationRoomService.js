const crypto = require('crypto');
const ConsultationRoom = require('../models/ConsultationRoom');

const ensureConsultationRoom = async appointment => {
    if (!['video', 'chat'].includes(appointment.consultationType) || appointment.paymentStatus !== 'completed') {
        return null;
    }

    const scheduledAt = new Date(appointment.appointmentDate);
    const [hours, minutes] = String(appointment.appointmentTime).split(':').map(Number);
    scheduledAt.setHours(hours, minutes, 0, 0);
    const joinFrom = new Date(scheduledAt.getTime() - 15 * 60 * 1000);
    const joinUntil = new Date(scheduledAt.getTime() + (appointment.duration || 60) * 60 * 1000);

    const room = await ConsultationRoom.findOneAndUpdate(
        { appointmentId: appointment._id },
        {
            $setOnInsert: {
                appointmentId: appointment._id,
                roomId: crypto.randomUUID(),
                patientId: appointment.patientId,
                doctorId: appointment.doctorId,
                joinFrom,
                joinUntil
            }
        },
        { upsert: true, new: true }
    );

    if (appointment.roomId !== room.roomId) {
        appointment.roomId = room.roomId;
        await appointment.save();
    }
    return room;
};

module.exports = { ensureConsultationRoom };