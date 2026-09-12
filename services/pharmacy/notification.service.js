const { Notification, User } = require('../../models/pharmacy');
const { emitToBranch, emitToUser } = require('../../socket/pharmacyEvents');


const sendFcmPushNotification = async (fcmToken, title, message, dataPayload = {}) => {
    if (!fcmToken) return;
    try {
        if (process.env.FCM_SERVER_KEY) {
            console.log(`[FCM] Sent to token ${fcmToken.slice(0, 10)}...: ${title}`);
        }
    } catch (err) {
        console.warn(`[FCM] Failed to deliver push notification: ${err.message}`);
    }
};

const sendNotification = async ({ branchId, userId = null, title, message, type = 'SYSTEM', dataPayload = null }) => {
    const notification = await Notification.create({
        branch_id: branchId,
        user_id: userId,
        title,
        message,
        type,
        data: dataPayload,
        is_read: false,
    });

    const eventPayload = {
        id: notification._id.toString(),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        dataPayload: notification.data,
        created_at: notification.created_at,
    };

    if (userId) {
        emitToUser(userId.toString(), 'notification:new', eventPayload);
        emitToUser(userId.toString(), 'notification:stream', eventPayload);

        User.findById(userId).then((user) => {
            if (user && user.fcm_token) {
                sendFcmPushNotification(user.fcm_token, title, message, dataPayload);
            }
        }).catch(() => {});
    } else if (branchId) {
        emitToBranch(branchId.toString(), 'notification:new', eventPayload);
        emitToBranch(branchId.toString(), 'notification:stream', eventPayload);
    }

    return notification;
};

const getNotifications = async (branchId, userId, page = 1, limit = 20) => {
    const filter = { branch_id: branchId };
    if (userId) {
        filter.$or = [{ user_id: userId }, { user_id: null }];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limitNum),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, is_read: false }),
    ]);

    return {
        notifications,
        unread_count: unreadCount,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

const markAsRead = async (branchId, notificationId) => {
    const notification = await Notification.findOne({
        _id: notificationId,
        branch_id: branchId,
    });

    if (notification) {
        notification.is_read = true;
        await notification.save();
    }

    return { message: 'Notification marked as read' };
};

const markAllAsRead = async (branchId, userId) => {
    const filter = { branch_id: branchId, is_read: false };
    if (userId) {
        filter.$or = [{ user_id: userId }, { user_id: null }];
    }

    await Notification.updateMany(filter, { is_read: true });

    return { message: 'All notifications marked as read' };
};

module.exports = {
    sendNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
};
