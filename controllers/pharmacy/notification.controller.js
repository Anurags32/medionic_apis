const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const notificationService = require('../../services/pharmacy/notification.service');


const getNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await notificationService.getNotifications(
        req.user.branchId,
        req.user.userId,
        page,
        limit
    );
    res.status(200).json(new ApiResponse(200, result, 'Notifications fetched successfully'));
});

const markAsRead = asyncHandler(async (req, res) => {
    const result = await notificationService.markAsRead(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'Notification marked as read'));
});

const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.user.branchId, req.user.userId);
    res.status(200).json(new ApiResponse(200, result, 'All notifications marked as read'));
});

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
};
