const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: [true, 'Room ID is required'],
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender ID is required']
    },
    senderRole: {
        type: String,
        enum: ['patient', 'doctor'],
        required: [true, 'Sender role is required']
    },
    text: {
        type: String,
        required: [true, 'Message text is required'],
        trim: true
    },
    readAt: {
        type: Date
    }
}, {
    timestamps: true
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
