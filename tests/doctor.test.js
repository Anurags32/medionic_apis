const request = require('supertest');
const app = require('../server');

describe('Doctor Endpoints', () => {
    let doctorToken;

    beforeAll(async () => {
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'dr.smith@hospital.com',
                password: 'Password123!'
            });

        doctorToken = loginResponse.body.token;
    });

    describe('GET /api/doctors/profile', () => {
        it('should get doctor profile', async () => {
            const response = await request(app)
                .get('/api/doctors/profile')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.firstName).toBeDefined();
            expect(response.body.data.specialization).toBeDefined();
        });
    });

    describe('GET /api/doctors/dashboard', () => {
        it('should get doctor dashboard', async () => {
            const response = await request(app)
                .get('/api/doctors/dashboard')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.overview).toBeDefined();
            expect(response.body.data.upcomingAppointments).toBeDefined();
        });
    });

    describe('GET /api/doctors/appointments', () => {
        it('should get doctor appointments', async () => {
            const response = await request(app)
                .get('/api/doctors/appointments')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('GET /api/doctors/patients', () => {
        it('should get doctor patients', async () => {
            const response = await request(app)
                .get('/api/doctors/patients')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('POST /api/doctors/prescriptions', () => {
        it('should create prescription', async () => {
            // First get a patient ID from appointments
            const appointmentsResponse = await request(app)
                .get('/api/doctors/appointments')
                .set('Authorization', `Bearer ${doctorToken}`);

            if (appointmentsResponse.body.data.length === 0) {
                console.log('No appointments found for prescription test');
                return;
            }

            const patientId = appointmentsResponse.body.data[0].patient.patientId;

            const prescriptionData = {
                patientId,
                medicines: [
                    {
                        medicineName: 'Aspirin',
                        dosage: '81mg',
                        frequency: 'Once daily',
                        duration: '30 days',
                        quantity: 30
                    }
                ]
            };

            const response = await request(app)
                .post('/api/doctors/prescriptions')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send(prescriptionData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.prescriptionId).toBeDefined();
        });
    });

    describe('GET /api/doctors/schedule', () => {
        it('should get doctor schedule', async () => {
            const response = await request(app)
                .get('/api/doctors/schedule')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.availability).toBeDefined();
        });
    });

    describe('PUT /api/doctors/schedule', () => {
        it('should update doctor schedule', async () => {
            const scheduleData = {
                availability: {
                    monday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }],
                    tuesday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }]
                }
            };

            const response = await request(app)
                .put('/api/doctors/schedule')
                .set('Authorization', `Bearer ${doctorToken}`)
                .send(scheduleData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});