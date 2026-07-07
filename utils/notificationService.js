/**
 * Notification Service Stub
 * In production, this service would connect to Nodemailer, Twilio, or Firebase Cloud Messaging (FCM).
 */
exports.sendNotification = async ({ type, userId, message }) => {
    try {
        console.log(`\n🔔  [NOTIFICATION] [${new Date().toISOString()}]`);
        console.log(`    Recipient User ID : ${userId}`);
        console.log(`    Notification Type : ${type.toUpperCase()}`);
        console.log(`    Message           : ${message}`);
        console.log('================================================\n');
        
        return {
            success: true,
            sentAt: new Date()
        };
    } catch (error) {
        console.error('❌  Notification Service error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};
