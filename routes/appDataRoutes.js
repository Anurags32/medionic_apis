const express = require('express');
const router = express.Router();
const { sendCallNotification } = require('../controllers/appDataController');

// POST /api/app_data/send_call_notification
router.post('/send_call_notification', sendCallNotification);

module.exports = router;
