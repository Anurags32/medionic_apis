const mongoose = require('mongoose');

const consultationRoomSchema = new mongoose.Schema({
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    roomId: { type: String, required: true, unique: true, immutable: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    joinFrom: { type: Date, required: true },
    joinUntil: { type: Date, required: true },
    state: { type: String, enum: ['pending', 'open', 'active', 'ended', 'missed'], default: 'pending' }
}, { timestamps: true });

consultationRoomSchema.index({ roomId: 1 }, { unique: true });
consultationRoomSchema.index({ joinUntil: 1 });

module.exports = mongoose.model('ConsultationRoom', consultationRoomSchema);