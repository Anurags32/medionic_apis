const request = require('supertest');
const app = require('../server');
const fcmService = require('../services/fcmService');

// Mock fcmService
jest.mock('../services/fcmService');

describe('POST /api/app_data/send_call_notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/app_data/send_call_notification')
      .send({
        title: 'Incoming Call',
        body: 'Dr. John is calling'
        // missing fcm_token and data
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      result: 'F',
      status: '1',
      Message: expect.stringContaining('fcm_token is required'),
      JSONData: []
    });
  });

  it('should return 400 when data object is missing', async () => {
    const res = await request(app)
      .post('/api/app_data/send_call_notification')
      .send({
        fcm_token: 'fake_fcm_token_123',
        title: 'Incoming Call',
        body: 'Dr. John is calling'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.result).toBe('F');
    expect(res.body.status).toBe('1');
    expect(res.body.Message).toContain('data must be a valid JSON object');
  });

  it('should successfully send a call notification with data-only payload', async () => {
    fcmService.sendCallNotification.mockResolvedValue('projects/test-app/messages/msg_12345');

    const payload = {
      fcm_token: 'valid_target_device_fcm_token',
      title: 'Incoming Audio Call',
      body: 'Dr. Anurag Tiwari is calling you...',
      data: {
        type: 'call_invite',
        call_type: 'audio',
        call_id: 'booking_9988',
        caller_name: 'Dr. Anurag Tiwari',
        caller_id: 'doc_123',
        enquiry_id: 'enq_456'
      }
    };

    const res = await request(app)
      .post('/api/app_data/send_call_notification')
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      result: 'S',
      status: '0',
      Message: 'Call notification sent successfully!',
      JSONData: [
        {
          msg: 'Call notification sent successfully!',
          messageId: 'projects/test-app/messages/msg_12345'
        }
      ]
    });

    expect(fcmService.sendCallNotification).toHaveBeenCalledWith({
      fcm_token: payload.fcm_token,
      title: payload.title,
      body: payload.body,
      data: payload.data
    });
  });

  it('should handle invalid/expired FCM registration token gracefully', async () => {
    const error = new Error('Invalid or expired FCM registration token (device unregistered)');
    error.statusCode = 400;
    error.fcmCode = 'messaging/registration-token-not-registered';
    fcmService.sendCallNotification.mockRejectedValue(error);

    const payload = {
      fcm_token: 'expired_fcm_token',
      title: 'Incoming Call',
      body: 'Call from user',
      data: {
        type: 'call_invite',
        call_type: 'video',
        call_id: 'call_1122'
      }
    };

    const res = await request(app)
      .post('/api/app_data/send_call_notification')
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      result: 'F',
      status: '1',
      Message: 'Invalid or expired FCM registration token (device unregistered)',
      JSONData: []
    });
  });
});
