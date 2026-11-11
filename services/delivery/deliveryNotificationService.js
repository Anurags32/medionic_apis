const { getMessaging } = require('../../config/firebase');
const { DeliveryNotification } = require('../../models/delivery');
const { NOTIFICATION_TYPES } = require('../../config/deliveryConstants');
const { emitDeliveryEvent } = require('../../socket/deliveryEvents');

/**
 * Sends a background/foreground push notification via Firebase Admin FCM
 */
async function sendDeliveryFCM({ fcmToken, title, body, data = {} }) {
    if (!fcmToken) return null;

    try {
        const messaging = getMessaging();
        if (!messaging) return null;

        const stringifiedData = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
        }

        const message = {
            token: fcmToken,
            notification: {
                title: String(title),
                body: String(body),
            },
            data: stringifiedData,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'delivery_alerts',
                },
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                },
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true,
                    },
                },
            },
        };

        const response = await messaging.send(message);
        return response;
    } catch (err) {
        // Safe swallow non-critical FCM delivery failures (e.g., token expired or bad token)
        console.warn(`[FCM-Delivery] Notification delivery failed: ${err.message}`);
        return null;
    }
}

/**
 * Creates an in-app notification record and broadcasts via Socket & FCM
 */
async function notifyPartner({ partnerId, orderId = null, type, title, message, data = {}, fcmToken = null }) {
    try {
        const doc = await DeliveryNotification.create({
            partner_id: partnerId,
            order_id: orderId,
            notification_type: type,
            title,
            message,
            data,
        });

        // Real-time socket event
        emitDeliveryEvent(`partner:${partnerId}`, 'delivery_notification', {
            id: doc._id.toString(),
            type,
            title,
            message,
            data,
            createdAt: doc.created_at,
        });

        // FCM push
        if (fcmToken) {
            await sendDeliveryFCM({
                fcmToken,
                title,
                body: message,
                data: { ...data, type },
            });
        }

        return doc;
    } catch (err) {
        console.warn(`[DeliveryNotification] Failed to create notification: ${err.message}`);
        return null;
    }
}

module.exports = {
    sendDeliveryFCM,
    notifyPartner,
};

