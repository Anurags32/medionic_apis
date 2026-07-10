const request = require('supertest');
const app = require('../server');
const Doctor = require('../models/Doctor');
const MedicalRep = require('../models/MedicalRep');
const User = require('../models/User');

describe('Admin Doctor & MR Verification Endpoints', () => {
    let adminToken;
    let testDoctor;
    let testMR;

    beforeAll(async () => {
        // Log in as admin
        const loginResponse = await request(app)
            .post('/api/admin/login')
            .send({
                email: 'admin@healthcare.com',
                password: 'Admin@1234'
            });

        adminToken = loginResponse.body.token;

        // Retrieve one seeded Doctor and MR for tests
        testDoctor = await Doctor.findOne();
        testMR = await MedicalRep.findOne();
    });

    describe('GET /api/admin/doctors/:id', () => {
        it('should fetch the full doctor profile including user details', async () => {
            const res = await request(app)
                .get(`/api/admin/doctors/${testDoctor._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data._id).toBe(testDoctor._id.toString());
            expect(res.body.data.userId).toBeDefined();
            expect(res.body.data.userId.email).toBeDefined();
            expect(res.body.data.userId.role).toBe('doctor');
        });

        it('should return 404 for non-existent doctor ID', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            await request(app)
                .get(`/api/admin/doctors/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });
    });

    describe('GET /api/admin/mr/:id', () => {
        it('should fetch the full MR profile including user details', async () => {
            const res = await request(app)
                .get(`/api/admin/mr/${testMR._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data._id).toBe(testMR._id.toString());
            expect(res.body.data.userId).toBeDefined();
            expect(res.body.data.userId.email).toBeDefined();
            expect(res.body.data.userId.role).toBe('mr');
        });

        it('should return 404 for non-existent MR ID', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            await request(app)
                .get(`/api/admin/mr/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });
    });

    describe('PUT /api/admin/doctors/:id/approve', () => {
        it('should approve doctor registration and set user to verified', async () => {
            // First reset status to pending and isVerified to false
            await Doctor.findByIdAndUpdate(testDoctor._id, { verificationStatus: 'pending' });
            await User.findByIdAndUpdate(testDoctor.userId, { isVerified: false });

            const res = await request(app)
                .put(`/api/admin/doctors/${testDoctor._id}/approve`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ remarks: 'Valid credentials' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.verificationStatus).toBe('verified');

            // Verify user status in DB
            const updatedUser = await User.findById(testDoctor.userId);
            expect(updatedUser.isVerified).toBe(true);
        });
    });

    describe('PUT /api/admin/doctors/:id/reject', () => {
        it('should reject doctor registration and set user isVerified to false', async () => {
            const res = await request(app)
                .put(`/api/admin/doctors/${testDoctor._id}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ remarks: 'Invalid license copy' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.verificationStatus).toBe('rejected');

            // Verify user status in DB
            const updatedUser = await User.findById(testDoctor.userId);
            expect(updatedUser.isVerified).toBe(false);

            // Verify remark is added to bio
            const updatedDoctor = await Doctor.findById(testDoctor._id);
            expect(updatedDoctor.bio).toContain('[Admin Note]: Invalid license copy');
        });
    });

    describe('PUT /api/admin/mr/:id/approve', () => {
        it('should approve MR registration and set user to verified', async () => {
            // First reset status to pending and isVerified to false
            await MedicalRep.findByIdAndUpdate(testMR._id, { verificationStatus: 'pending' });
            await User.findByIdAndUpdate(testMR.userId, { isVerified: false });

            const res = await request(app)
                .put(`/api/admin/mr/${testMR._id}/approve`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ remarks: 'Approved' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.verificationStatus).toBe('verified');
            expect(res.body.data.remarks).toBe('Approved');

            // Verify user status in DB
            const updatedUser = await User.findById(testMR.userId);
            expect(updatedUser.isVerified).toBe(true);
        });
    });

    describe('PUT /api/admin/mr/:id/reject', () => {
        it('should reject MR registration and set user isVerified to false', async () => {
            const res = await request(app)
                .put(`/api/admin/mr/${testMR._id}/reject`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ remarks: 'Unclear documents' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.verificationStatus).toBe('rejected');
            expect(res.body.data.remarks).toBe('Unclear documents');

            // Verify user status in DB
            const updatedUser = await User.findById(testMR.userId);
            expect(updatedUser.isVerified).toBe(false);
        });
    });
});
