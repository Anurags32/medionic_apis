const fcmService = require('../services/fcmService');

/**
 * @desc    Send FCM push notification for ZegoCloud incoming call invite (data-only message)
 * @route   POST /api/app_data/send_call_notification
 * @access  Public / App Data
 */
exports.sendCallNotification = async (req, res) => {
  try {
    const { fcm_token, title, body, data } = req.body;

    // 1. Validation for required fields
    if (!fcm_token || typeof fcm_token !== 'string' || !fcm_token.trim()) {
      return res.status(400).json({
        result: 'F',
        status: '1',
        Message: 'Validation Error: fcm_token is required and must be a non-empty string',
        JSONData: []
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        result: 'F',
        status: '1',
        Message: 'Validation Error: title is required and must be a non-empty string',
        JSONData: []
      });
    }

    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({
        result: 'F',
        status: '1',
        Message: 'Validation Error: body is required and must be a non-empty string',
        JSONData: []
      });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({
        result: 'F',
        status: '1',
        Message: 'Validation Error: data must be a valid JSON object with call payload',
        JSONData: []
      });
    }

    // 2. Send FCM message via service
    const messageId = await fcmService.sendCallNotification({
      fcm_token: fcm_token.trim(),
      title: title.trim(),
      body: body.trim(),
      data
    });

    console.log(`📲 Call notification sent successfully. Message ID: ${messageId}`);

    // 3. Success Response
    return res.status(200).json({
      result: 'S',
      status: '0',
      Message: 'Call notification sent successfully!',
      JSONData: [{ msg: 'Call notification sent successfully!', messageId }]
    });

  } catch (error) {
    console.error('❌ Error in sendCallNotification controller:', error);

    const statusCode = error.statusCode || (error.code && error.code.startsWith('messaging/') ? 400 : 500);
    const errorMessage = error.message || 'Failed to send call notification due to server error';

    // 4. Failure Response
    return res.status(statusCode).json({
      result: 'F',
      status: '1',
      Message: errorMessage,
      JSONData: []
    });
  }
};
