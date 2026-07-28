const request = require('supertest');
const app = require('../server');

describe('Doctor Endpoints', () => {
    let doctorToken;

    beforeAll(async () => {
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'dr.sharma@hospital.com',
                password: 'Doctor@1234'
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

            const appointmentId = appointmentsResponse.body.data[0].appointmentId;
            const patientId = appointmentsResponse.body.data[0].patient.patientId;

            const prescriptionData = {
                patientId,
                appointmentId,
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

    describe('Comprehensive Appointment, Completion, and Rating Flow', () => {
        let patientToken;
        let appointmentId;
        let doctorId;

        beforeAll(async () => {
            // Login as patient
            const patientLoginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'aarav.gupta@gmail.com',
                    password: 'Patient@1234'
                });
            patientToken = patientLoginRes.body.token;

            // Get a doctor ID matching Dr. Sharma
            const doctorsRes = await request(app)
                .get('/api/patients/doctors')
                .set('Authorization', `Bearer ${patientToken}`);
            
            const sharmaDoctor = doctorsRes.body.data.find(d => d.fullName.includes('Sharma') || d.fullName.includes('Rajesh'));
            doctorId = sharmaDoctor.doctorId;
        });

        it('should book appointment for today and verify it shows in doctor dashboard', async () => {
            const todayStr = new Date().toISOString().split('T')[0]; // date-only format like 2026-07-28

            const appointmentData = {
                doctorId,
                appointmentDate: todayStr,
                appointmentTime: '11:00',
                consultationType: 'clinic',
                symptoms: 'Mild fever and cough since today morning'
            };

            // Book patient appointment
            const bookRes = await request(app)
                .post('/api/patients/appointments')
                .set('Authorization', `Bearer ${patientToken}`)
                .send(appointmentData)
                .expect(201);

            appointmentId = bookRes.body.data.appointmentId;
            expect(appointmentId).toBeDefined();

            // Check doctor dashboard. Since the appointment is scheduled for today, 
            // it must show up in upcomingAppointments list.
            const dashboardRes = await request(app)
                .get('/api/doctors/dashboard')
                .set('Authorization', `Bearer ${doctorToken}`)
                .expect(200);

            expect(dashboardRes.body.success).toBe(true);
            const upcomingList = dashboardRes.body.data.upcomingAppointments;
            expect(upcomingList).toBeDefined();
            
            const found = upcomingList.find(apt => apt.appointmentId.toString() === appointmentId.toString());
            expect(found).toBeDefined();
            expect(found.status).toBe('pending');
        });

        it('should fail to mark a future appointment as completed', async () => {
            const tomorrowStr = new Date();
            tomorrowStr.setDate(tomorrowStr.getDate() + 2);
            const tomorrowDateStr = tomorrowStr.toISOString().split('T')[0];

            // 1. Patient books a future appointment
            const futureApt = await request(app)
                .post('/api/patients/appointments')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    doctorId,
                    appointmentDate: tomorrowDateStr,
                    appointmentTime: '12:00',
                    consultationType: 'clinic',
                    symptoms: 'Checkup for next week'
                })
                .expect(201);

            const futureAptId = futureApt.body.data.appointmentId;

            // 2. Doctor attempts to complete future appointment
            const completeRes = await request(app)
                .put(`/api/doctors/appointments/${futureAptId}/complete`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ notes: 'Completed in future', diagnosis: 'None' })
                .expect(400);

            expect(completeRes.body.success).toBe(false);
            expect(completeRes.body.message).toContain('Cannot mark a future appointment as completed');
        });

        it('should complete today\'s appointment and let the patient rate it', async () => {
            // 1. Doctor marks today's appointment as completed
            const completeRes = await request(app)
                .put(`/api/doctors/appointments/${appointmentId}/complete`)
                .set('Authorization', `Bearer ${doctorToken}`)
                .send({ notes: 'Patient had normal temperature. Prescribed rest.', diagnosis: 'Mild viral fever' })
                .expect(200);

            expect(completeRes.body.success).toBe(true);
            expect(completeRes.body.data.status).toBe('completed');

            // 2. Patient rates the completed appointment
            const rateRes = await request(app)
                .post(`/api/patients/appointments/${appointmentId}/rate`)
                .set('Authorization', `Bearer ${patientToken}`)
                .send({
                    rating: 5,
                    feedback: 'Great diagnostic session, very patient doctor.'
                })
                .expect(200);

            expect(rateRes.body.success).toBe(true);
            expect(rateRes.body.data.rating.value).toBe(5);
            expect(rateRes.body.data.rating.feedback).toBe('Great diagnostic session, very patient doctor.');
        });
    });
});