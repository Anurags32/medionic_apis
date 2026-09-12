const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/pharmacy/notification.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');

router.use(authenticateToken);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);

module.exports = router;
