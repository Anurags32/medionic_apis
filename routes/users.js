/**
 * routes/users.js
 *
 * User-level utility endpoints.
 * 
 * Routes:
 *   POST /api/users/fcm-token   → Save/update device FCM token for push notifications
 *   DELETE /api/users/fcm-token → Clear FCM token on logout
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

/**
 * @route   POST /api/users/fcm-token
 * @desc    Register or refresh the device FCM push token for the authenticated user.
 * @access  Protected
 * @body    { fcmToken: string, platform?: 'android'|'ios'|'web' }
 */
router.post('/fcm-token', protect, async (req, res) => {
  try {
    const { fcmToken, platform } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string' || !fcmToken.trim()) {
      return res.status(400).json({
        result: 'F',
        status: '1',
        Message: 'fcmToken is required and must be a non-empty string',
        JSONData: []
      });
    }

    const allowedPlatforms = ['android', 'ios', 'web'];
    const resolvedPlatform = allowedPlatforms.includes(platform) ? platform : null;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        fcmToken: fcmToken.trim(),
        fcmPlatform: resolvedPlatform,
        fcmUpdatedAt: new Date()
      },
      { new: true, runValidators: false }
    ).select('_id email fcmToken fcmPlatform fcmUpdatedAt');

    if (!updatedUser) {
      return res.status(404).json({
        result: 'F',
        status: '1',
        Message: 'User not found',
        JSONData: []
      });
    }

    console.log(`[FCM Token] Updated for user ${req.user._id} (platform: ${resolvedPlatform || 'unknown'})`);

    return res.status(200).json({
      result: 'S',
      status: '0',
      Message: 'FCM token saved successfully',
      JSONData: [{
        userId: updatedUser._id,
        fcmPlatform: updatedUser.fcmPlatform,
        fcmUpdatedAt: updatedUser.fcmUpdatedAt
      }]
    });
  } catch (error) {
    console.error('[FCM Token] POST error:', error.message);
    return res.status(500).json({
      result: 'F',
      status: '1',
      Message: 'Failed to save FCM token',
      JSONData: []
    });
  }
});

/**
 * @route   DELETE /api/users/fcm-token
 * @desc    Clear the FCM token on logout (stop receiving push notifications on this device).
 * @access  Protected
 */
router.delete('/fcm-token', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      { fcmToken: null, fcmPlatform: null, fcmUpdatedAt: new Date() },
      { runValidators: false }
    );

    console.log(`[FCM Token] Cleared for user ${req.user._id}`);

    return res.status(200).json({
      result: 'S',
      status: '0',
      Message: 'FCM token cleared successfully',
      JSONData: []
    });
  } catch (error) {
    console.error('[FCM Token] DELETE error:', error.message);
    return res.status(500).json({
      result: 'F',
      status: '1',
      Message: 'Failed to clear FCM token',
      JSONData: []
    });
  }
});

module.exports = router;
