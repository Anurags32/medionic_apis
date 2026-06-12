const request = require('supertest');
const app = require('../server');

describe('Patient Endpoints', () => {
    let patientToken;

    beforeAll(async () => {
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'john.doe@email.com',
                password: 'Password123!'
            });

        patientToken = loginResponse.body.token;
    });

    describe('GET /api/patients/profile', () => {
        it('should get patient profile', async () => {
            const response = await request(app)
                .get('/api/patients/profile')
                .set('Authorization', `Bearer ${patientToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.firstName).toBeDefined();
        });
    });

    describe('GET /api/patients/doctors', () => {
        it('should search doctors', async () => {
            const response = await request(app)
                .get('/api/patients/doctors')
                .set('Authorization', `Bearer ${patientToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should filter doctors by specialization', async () => {
            const response = await request(app)
                .get('/api/patients/doctors?specialization=Cardiology')
                .set('Authorization', `Bearer ${patientToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            // Should only return cardiologists
            response.body.data.forEach(doctor => {
                expect(doctor.specialization.toLowerCase()).toContain('cardiology');
            });
        });
    });

    describe('POST /api/patients/appointments', () => {
        it('should book appointment with valid data', async () => {
            // First get a doctor ID
            const doctorsResponse = await request(app)
                .get('/api/patients/doctors')
                .set('Authorization', `Bearer ${patientToken}`);

            const doctorId = doctorsResponse.body.data[0].doctorId;

            const appointmentData = {
                doctorId,
                appointmentDate: '2024-12-31',
                appointmentTime: '10:00',
                consultationType: 'clinic',
                symptoms: 'Regular checkup'
            };

            const response = await request(app)
                .post('/api/patients/appointments')
                .set('Authorization', `Bearer ${patientToken}`)
                .send(appointmentData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.appointmentId).toBeDefined();
        });

        it('should not book appointment with invalid data', async () => {
            const appointmentData = {
                doctorId: 'invalid-id',
                appointmentDate: '2024-12-31',
                appointmentTime: '10:00',
                consultationType: 'clinic',
                symptoms: 'Test'
            };

            const response = await request(app)
                .post('/api/patients/appointments')
                .set('Authorization', `Bearer ${patientToken}`)
                .send(appointmentData)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/patients/appointments', () => {
        it('should get patient appointments', async () => {
            const response = await request(app)
                .get('/api/patients/appointments')
                .set('Authorization', `Bearer ${patientToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('POST /api/patients/health-tracking', () => {
        it('should log health metric', async () => {
            const metricData = {
                metricType: 'BP',
                value: '120/80',
                unit: 'mmHg'
            };

            const response = await request(app)
                .post('/api/patients/health-tracking')
                .set('Authorization', `Bearer ${patientToken}`)
                .send(metricData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.metricId).toBeDefined();
        });

        it('should not log invalid health metric', async () => {
            const metricData = {
                metricType: 'BP',
                value: 'invalid-bp',
                unit: 'mmHg'
            };

            const response = await request(app)
                .post('/api/patients/health-tracking')
                .set('Authorization', `Bearer ${patientToken}`)
                .send(metricData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });
});