// End-to-end over HTTP (supertest): pharmacy owner registers, cannot log in
// while pending, an admin approves or rejects from the admin API, and an
// approved owner logs in with a fresh 14-day trial.
const request = require('supertest');
const app = require('../../server');
const { Branch, User: PharmacyUser } = require('../../models/pharmacy');
const { inDays } = require('./helpers');

const ADMIN_SECRET = 'e2e-admin-registration-secret';
const OWNER_PASSWORD = 'Onboard@2026';
let adminToken;
let seq = 0;

const registerPharmacy = async () => {
    seq += 1;
    const tag = `${Date.now().toString().slice(-6)}${seq}`;
    const email = `e2e.owner.${tag}@example.com`;
    const phone = `97${tag}`.padEnd(10, '0').slice(0, 10);
    const res = await request(app).post('/api/v1/auth/register').send({
        full_name: 'E2E Owner',
        email,
        phone,
        password: OWNER_PASSWORD,
        branch_details: {
            name: `E2E Pharmacy ${tag}`,
            drug_license_no: `DL-E2E-20B-${tag}`,
            gstin: '09AABCT1234F1Z5',
            address: 'Shop 1, Test Market, Lucknow, UP 226001',
            contact_number: phone,
            email,
        },
    });
    expect(res.status).toBe(201);
    const owner = await PharmacyUser.findOne({ email });
    return { email, owner, storeName: `E2E Pharmacy ${tag}` };
};

const ownerLogin = (email) => request(app).post('/api/v1/auth/login').send({ email, password: OWNER_PASSWORD });

beforeAll(async () => {
    process.env.ADMIN_REGISTRATION_SECRET = ADMIN_SECRET;
    const email = `e2e.admin.${Date.now()}@example.com`;
    const reg = await request(app).post('/api/admin/register').send({
        fullName: 'E2E Admin', email, password: 'Admin@E2E123', secretKey: ADMIN_SECRET, phone: '9000012345',
    });
    expect([200, 201]).toContain(reg.status);
    const login = await request(app).post('/api/admin/login').send({ email, password: 'Admin@E2E123' });
    expect(login.status).toBe(200);
    adminToken = login.body.token || login.body.data?.token;
    expect(adminToken).toBeTruthy();
});

const admin = (req) => req.set('Authorization', `Bearer ${adminToken}`);

describe('admin approval of a new pharmacy (HTTP)', () => {
    test('pending → blocked; admin approves; owner logs in with a full 14-day trial', async () => {
        const { email, owner, storeName } = await registerPharmacy();

        // Registered 3 days ago and still waiting: trial clock would have run down.
        const branch = await Branch.findById(owner.branch_id);
        branch.subscription = { ...Branch.trialSubscription(), start_date: inDays(-3), expiry_date: inDays(11) };
        await branch.save();

        const before = await ownerLogin(email);
        expect(before.status).toBe(403);
        expect(before.body.code || before.body.error?.code).toBe('ACCOUNT_PENDING_APPROVAL');

        // Admin sees it in the pending list with store details for verification.
        const list = await admin(request(app).get('/api/admin/pharmacy-owners').query({ status: 'pending', limit: 100 }));
        expect(list.status).toBe(200);
        const row = list.body.data.find((o) => o.email === email);
        expect(row).toBeTruthy();
        expect(row.branch.name).toBe(storeName);
        expect(row.branch.drug_license_no).toMatch(/^DL-E2E-20B-/);
        expect(row.branch.gstin).toBe('09AABCT1234F1Z5');

        const approve = await admin(request(app).put(`/api/admin/pharmacy-owners/${owner._id}/approve`).send({ remarks: 'DL and GSTIN verified' }));
        expect(approve.status).toBe(200);
        expect(approve.body.success).toBe(true);

        const after = await ownerLogin(email);
        expect(after.status).toBe(200);
        const token = after.body.data.accessToken;

        const sub = await request(app).get('/api/v1/branch/subscription').set('Authorization', `Bearer ${token}`);
        expect(sub.status).toBe(200);
        expect(sub.body.data).toMatchObject({ plan_id: 'trial', is_trial: true, status: 'ACTIVE', days_left: 14 });

        const pending = await admin(request(app).get('/api/admin/pharmacy-owners').query({ status: 'pending', limit: 100 }));
        expect(pending.body.data.find((o) => o.email === email)).toBeUndefined();
    });

    test('rejected owner cannot log in and sees the reason', async () => {
        const { email, owner } = await registerPharmacy();
        const reject = await admin(request(app).put(`/api/admin/pharmacy-owners/${owner._id}/reject`).send({ reason: 'GSTIN does not match the store name' }));
        expect(reject.status).toBe(200);

        const login = await ownerLogin(email);
        expect(login.status).toBe(403);
        expect(login.body.code || login.body.error?.code).toBe('ACCOUNT_REJECTED');
    });

    test('admin endpoints refuse anonymous and pharmacy-owner tokens', async () => {
        const anon = await request(app).get('/api/admin/pharmacy-owners');
        expect(anon.status).toBe(401);

        const { email, owner } = await registerPharmacy();
        await admin(request(app).put(`/api/admin/pharmacy-owners/${owner._id}/approve`).send({}));
        const ownerToken = (await ownerLogin(email)).body.data.accessToken;
        const asOwner = await request(app).get('/api/admin/pharmacy-owners').set('Authorization', `Bearer ${ownerToken}`);
        expect([401, 403]).toContain(asOwner.status);

        const selfApprove = await request(app)
            .put(`/api/admin/pharmacy-owners/${owner._id}/approve`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({});
        expect([401, 403]).toContain(selfApprove.status);
    });
});
