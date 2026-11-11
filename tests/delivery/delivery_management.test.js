const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const {
    DeliveryPartner,
    PharmacyDeliverySettings,
    DeliveryAssignment,
    Delivery,
    DeliveryEarning,
} = require('../../models/delivery');
const Branch = require('../../models/pharmacy/branch.model');
const Order = require('../../models/pharmacy/order.model');
const {
    PARTNER_TYPES,
    PARTNER_ACCOUNT_STATUS,
    PARTNER_VERIFICATION_STATUS,
    DELIVERY_STATUS,
    ASSIGNMENT_STATUS,
} = require('../../config/deliveryConstants');

describe('MediSleep Complete Delivery Management Subsystem', () => {
    let adminToken;
    let pharmacyToken;
    let testBranch1;
    let testBranch2;
    let platformPartnerToken;
    let platformPartnerId;
    let pharmacyStaffToken;
    let pharmacyStaffId;
    let testOrder;
    let assignedPartnerToken;
    let unassignedPartnerToken;

    beforeAll(async () => {
        // 1. Authenticate Admin
        const adminLogin = await request(app)
            .post('/api/admin/login')
            .send({
                email: 'admin@healthcare.com',
                password: 'Admin@1234',
            });
        adminToken = adminLogin.body.token;

        // 2. Create Two Test Pharmacy Branches for isolation testing
        testBranch1 = await Branch.create({
            name: 'Apollo Pharmacy Central',
            code: 'APO-CEN-' + Date.now().toString().slice(-4),
            drug_license_no: 'DL-APO-001',
            gstin: '07AAAAA0000A1Z5',
            address: '10 Connaught Place, New Delhi',
            contact_number: '9811001122',
            email: 'apollo.cp@gmail.com',
            latitude: 28.6315,
            longitude: 77.2167,
            location: {
                type: 'Point',
                coordinates: [77.2167, 28.6315],
            },
            subscription: {
                status: 'ACTIVE',
                plan_id: 'pro',
                expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });

        testBranch2 = await Branch.create({
            name: 'MedPlus South Ex',
            code: 'MED-SEX-' + Date.now().toString().slice(-4),
            drug_license_no: 'DL-MED-002',
            gstin: '07BBBBB1111B1Z6',
            address: '25 South Extension Part 2, New Delhi',
            contact_number: '9822003344',
            email: 'medplus.south@gmail.com',
            latitude: 28.5684,
            longitude: 77.2215,
            location: {
                type: 'Point',
                coordinates: [77.2215, 28.5684],
            },
            subscription: {
                status: 'ACTIVE',
                plan_id: 'pro',
                expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });

        // Initialize delivery settings for Branch 1
        await PharmacyDeliverySettings.create({
            pharmacy_id: testBranch1._id,
            delivery_mode: 'BOTH',
            max_assignment_radius_km: 15,
            assignment_timeout_seconds: 60,
        });

        // 3. Create a test Order in Branch 1
        testOrder = await Order.create({
            branch_id: testBranch1._id,
            order_number: 'ORD-TEST-' + Date.now(),
            order_type: 'DELIVERY',
            status: 'PACKED',
            delivery_address: 'Flat 402, Barakhamba Road, New Delhi',
            delivery_phone: '9899112233',
            delivery_pincode: '110001',
            subtotal: 500,
            net_amount: 500,
            delivery_required: true,
            drop_location: {
                address: 'Flat 402, Barakhamba Road, New Delhi',
                location: {
                    type: 'Point',
                    coordinates: [77.225, 28.629],
                },
            },
        });
    });

    describe('1. Platform Partner Registration & Authentication', () => {
        const partnerData = {
            full_name: 'Rajesh Kumar',
            email: 'rajesh.delivery@gmail.com',
            mobile: '9876543210',
            password: 'Partner@1234',
            vehicle_type: 'MOTORCYCLE',
            vehicle_number: 'DL-01-AB-1234',
        };

        it('should successfully register a new platform partner', async () => {
            const res = await request(app)
                .post('/api/delivery/auth/register')
                .send(partnerData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.partner.full_name).toBe(partnerData.full_name);
            expect(res.body.data.partner.partner_type).toBe(PARTNER_TYPES.PLATFORM_PARTNER);
            expect(res.body.data.partner.verification_status).toBe(PARTNER_VERIFICATION_STATUS.PENDING);
            expect(res.body.data.token).toBeDefined();

            platformPartnerToken = res.body.data.token;
            platformPartnerId = res.body.data.partner.id;
        });

        it('should prevent duplicate email registration', async () => {
            const res = await request(app)
                .post('/api/delivery/auth/register')
                .send(partnerData)
                .expect(409);

            expect(res.body.success).toBe(false);
        });

        it('should reject login with invalid credentials', async () => {
            const res = await request(app)
                .post('/api/delivery/auth/login')
                .send({
                    email: partnerData.email,
                    password: 'WrongPassword',
                })
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should successfully login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/delivery/auth/login')
                .send({
                    email: partnerData.email,
                    password: partnerData.password,
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            platformPartnerToken = res.body.data.token;
        });

        it('should get current authenticated partner profile (/me)', async () => {
            const res = await request(app)
                .get('/api/delivery/auth/me')
                .set('Authorization', `Bearer ${platformPartnerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.email).toBe(partnerData.email);
        });
    });

    describe('2. KYC Verification & Online Availability Rules', () => {
        it('should block KYC pending partner from going online', async () => {
            const res = await request(app)
                .put('/api/delivery/availability')
                .set('Authorization', `Bearer ${platformPartnerToken}`)
                .send({ is_online: true })
                .expect(403);

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('KYC_NOT_VERIFIED');
        });

        it('should allow partner to upload KYC document', async () => {
            const res = await request(app)
                .post('/api/delivery/kyc/upload')
                .set('Authorization', `Bearer ${platformPartnerToken}`)
                .send({
                    doc_type: 'DRIVING_LICENSE',
                    doc_number: 'DL-987654321',
                    doc_url: 'https://storage.medisleep.com/kyc/dl-rajesh.pdf',
                })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('should allow Admin to approve partner KYC', async () => {
            const res = await request(app)
                .put(`/api/admin/delivery/partners/${platformPartnerId}/verify`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: PARTNER_VERIFICATION_STATUS.VERIFIED,
                    remarks: 'Approved by admin',
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.verification_status).toBe(PARTNER_VERIFICATION_STATUS.VERIFIED);
        });

        it('should allow partner to go online after verification', async () => {
            const res = await request(app)
                .put('/api/delivery/availability')
                .set('Authorization', `Bearer ${platformPartnerToken}`)
                .send({ is_online: true, is_available: true })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.is_online).toBe(true);
        });

        it('should update partner real-time GPS location', async () => {
            const res = await request(app)
                .post('/api/delivery/location/update')
                .set('Authorization', `Bearer ${platformPartnerToken}`)
                .send({
                    latitude: 28.632,
                    longitude: 77.218, // Very close to Branch 1 (~300m)
                    heading: 90,
                    speed: 25,
                    accuracy: 5,
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.latitude).toBe(28.632);
        });
    });

    describe('3. Pharmacy Staff Invitation & Cross-Pharmacy Isolation', () => {
        const staffData = {
            branch_id: null,
            full_name: 'Amit Sharma (Staff)',
            email: 'amit.staff@apollocp.com',
            mobile: '9812345678',
            password: 'Staff@1234',
            vehicle_type: 'SCOOTER',
            vehicle_number: 'DL-02-CD-5678',
        };

        it('should allow pharmacy to create delivery staff tied to its branch', async () => {
            staffData.branch_id = testBranch1._id;

            const res = await request(app)
                .post('/api/pharmacy/delivery-staff')
                .set('Authorization', `Bearer ${adminToken}`) // Admin / Pharmacy owner authorized
                .send(staffData)
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.partner_type).toBe(PARTNER_TYPES.PHARMACY_STAFF);
            expect(res.body.data.pharmacy_id.toString()).toBe(testBranch1._id.toString());
            expect(res.body.data.verification_status).toBe(PARTNER_VERIFICATION_STATUS.VERIFIED);

            pharmacyStaffId = res.body.data.id || res.body.data._id;
        });

        it('should login pharmacy staff and toggle online status', async () => {
            const loginRes = await request(app)
                .post('/api/delivery/auth/login')
                .send({
                    email: staffData.email,
                    password: staffData.password,
                })
                .expect(200);

            pharmacyStaffToken = loginRes.body.data.token;

            const onlineRes = await request(app)
                .put('/api/delivery/availability')
                .set('Authorization', `Bearer ${pharmacyStaffToken}`)
                .send({ is_online: true, is_available: true })
                .expect(200);

            expect(onlineRes.body.data.is_online).toBe(true);

            // Set location for pharmacy staff
            await request(app)
                .post('/api/delivery/location/update')
                .set('Authorization', `Bearer ${pharmacyStaffToken}`)
                .send({
                    latitude: 28.6316,
                    longitude: 77.2168,
                });
        });

        it('should prevent Branch 2 from assigning or managing Branch 1 staff', async () => {
            // Attempt to assign Branch 1 staff to a Branch 2 order
            const branch2Order = await Order.create({
                branch_id: testBranch2._id,
                order_number: 'ORD-BR2-' + Date.now(),
                order_type: 'DELIVERY',
                status: 'PACKED',
                delivery_address: 'Lajpat Nagar, New Delhi',
                subtotal: 300,
                net_amount: 300,
            });

            const res = await request(app)
                .post(`/api/pharmacy/orders/${branch2Order._id}/assign-delivery`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    branch_id: testBranch2._id,
                    partner_id: pharmacyStaffId, // Belongs to Branch 1!
                })
                .expect(403);

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('STAFF_PHARMACY_MISMATCH');

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('STAFF_PHARMACY_MISMATCH');
        });
    });

    describe('4. Order Assignment Engine & Concurrency Control', () => {
        let assignmentId;

        it('should discover nearby delivery options for pharmacy order', async () => {
            const res = await request(app)
                .get(`/api/pharmacy/orders/${testOrder._id}/delivery-options`)
                .set('Authorization', `Bearer ${adminToken}`)
                .query({ branch_id: testBranch1._id.toString() })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.candidatesCount).toBeGreaterThan(0);
        });

        it('should auto-assign order to the nearest eligible partner', async () => {
            const res = await request(app)
                .post(`/api/pharmacy/orders/${testOrder._id}/auto-assign`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ branch_id: testBranch1._id.toString() })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.assignmentId).toBeDefined();

            assignmentId = res.body.data.assignmentId;
            assignedPartnerToken =
                res.body.data.partnerId.toString() === platformPartnerId.toString()
                    ? platformPartnerToken
                    : pharmacyStaffToken;
            unassignedPartnerToken =
                res.body.data.partnerId.toString() === platformPartnerId.toString()
                    ? pharmacyStaffToken
                    : platformPartnerToken;
        });

        it('should see the offered request in the partner requests feed', async () => {
            const res = await request(app)
                .get('/api/delivery/requests')
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should accept delivery request and generate pickup & delivery OTPs', async () => {
            const res = await request(app)
                .post(`/api/delivery/requests/${assignmentId}/accept`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.delivery).toBeDefined();
            expect(res.body.data.delivery.delivery_status).toBe(DELIVERY_STATUS.ASSIGNED);
        });

        it('should prevent duplicate acceptance of the already accepted assignment', async () => {
            const res = await request(app)
                .post(`/api/delivery/requests/${assignmentId}/accept`)
                .set('Authorization', `Bearer ${unassignedPartnerToken}`)
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('OFFER_NOT_AVAILABLE');
        });
    });

    describe('5. Delivery Lifecycle Transitions & OTP Verification', () => {
        let activeDelivery;
        let testPickupOtp = '123456';
        let testDeliveryOtp = '654321';

        beforeEach(async () => {
            activeDelivery = await Delivery.findOne({ order_id: testOrder._id });
            if (activeDelivery && !activeDelivery.pickup_verified_at) {
                const bcrypt = require('bcryptjs');
                activeDelivery.pickup_otp_hash = await bcrypt.hash(testPickupOtp, 10);
                activeDelivery.delivery_otp_hash = await bcrypt.hash(testDeliveryOtp, 10);
                await activeDelivery.save();
            }
        });

        it('should mark partner as reached pharmacy', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/reached-pharmacy`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.delivery_status).toBe(DELIVERY_STATUS.REACHED_PHARMACY);
        });

        it('should reject incorrect pickup OTP', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/verify-pickup-otp`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .send({ otp: '000000' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('INVALID_OTP');
        });

        it('should verify correct pickup OTP', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/verify-pickup-otp`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .send({ otp: testPickupOtp })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should confirm pickup with package proof', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/pickup-confirm`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .send({
                    notes: 'Package intact, medicine sealed',
                    image_url: 'https://storage.medisleep.com/proofs/pickup-1.jpg',
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.delivery_status).toBe(DELIVERY_STATUS.PICKED_UP);
        });

        it('should start out-for-delivery transit journey', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/start-delivery`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.delivery_status).toBe(DELIVERY_STATUS.OUT_FOR_DELIVERY);
        });

        it('should mark partner as reached customer location', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/reached-customer`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.delivery_status).toBe(DELIVERY_STATUS.REACHED_CUSTOMER);
        });

        it('should verify customer delivery OTP', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/verify-delivery-otp`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .send({ otp: testDeliveryOtp })
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should complete delivery, record earnings, and sync order status', async () => {
            const res = await request(app)
                .post(`/api/delivery/${activeDelivery._id}/complete`)
                .set('Authorization', `Bearer ${assignedPartnerToken}`)
                .send({
                    notes: 'Delivered to customer directly',
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.delivery.delivery_status).toBe(DELIVERY_STATUS.DELIVERED);
            expect(res.body.data.earning).toBeDefined();
            expect(res.body.data.earning.net_amount).toBeGreaterThan(0);

            // Check database synchronization
            const updatedOrder = await Order.findById(testOrder._id);
            expect(updatedOrder.delivery_status).toBe(DELIVERY_STATUS.DELIVERED);
        });
    });

    describe('6. Consumer Tracking & Admin Management', () => {
        it('should provide consumer live tracking info with masked partner details', async () => {
            const res = await request(app)
                .get(`/api/consumer/orders/${testOrder._id}/tracking`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.deliveryStatus).toBe(DELIVERY_STATUS.DELIVERED);
            expect(res.body.data.partner).toBeDefined();
            expect(['Rajesh Kumar', 'Amit Sharma (Staff)']).toContain(res.body.data.partner.name);
            // Ensure no sensitive fields are exposed
            expect(res.body.data.partner.password_hash).toBeUndefined();
            expect(res.body.data.partner.kyc_documents).toBeUndefined();
        });

        it('should allow Admin to view delivery analytics and partner roster', async () => {
            const analyticsRes = await request(app)
                .get('/api/admin/delivery/analytics')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(analyticsRes.body.success).toBe(true);
            expect(analyticsRes.body.data.partners.total).toBeGreaterThanOrEqual(2);
            expect(analyticsRes.body.data.deliveries.delivered).toBeGreaterThanOrEqual(1);

            const partnersRes = await request(app)
                .get('/api/admin/delivery/partners')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(partnersRes.body.success).toBe(true);
            expect(partnersRes.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });
});
