const express = require('express');
const router = express.Router();

const { videoSignal, getRoomMessages } = require('../controllers/consultationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/video/signal', videoSignal);

router.get('/:roomId/messages', getRoomMessages);

module.exports = router;
