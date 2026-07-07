const express = require('express');
const router = express.Router();

const { videoSignal, getRoomMessages } = require('../controllers/consultationController');
const { protect } = require('../middleware/auth');

// All consultation routes require authentication
router.use(protect);

// POST /api/consultations/video/signal — WebRTC signaling relay
router.post('/video/signal', videoSignal);

// GET /api/consultations/:roomId/messages — chat history for a room
router.get('/:roomId/messages', getRoomMessages);

module.exports = router;
