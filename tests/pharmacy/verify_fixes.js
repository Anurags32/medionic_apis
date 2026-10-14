/**
 * verify_fixes.js
 * Verification test suite for MediSlip Pharmacy Panel P1, P2, P3 & Security Fixes
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const app = require('../../server');
const Branch = require('../../models/pharmacy/branch.model');
const User = require('../../models/pharmacy/user.model');
const Category = require('../../models/pharmacy/category.model');
const Medicine = require('../../models/pharmacy/medicine.model');
const MedicineBatch = require('../../models/pharmacy/batch.model');
const PharmacyReturn = require('../../models/pharmacy/return.model');
const StockLog = require('../../models/pharmacy/stock-log.model');

const inventoryService = require('../../services/pharmacy/inventory.service');
const reportService = require('../../services/pharmacy/report.service');
const authService = require('../../services/pharmacy/auth.service');
const returnService = require('../../services/pharmacy/return.service');
const { generateAccessToken } = require('../../config/pharmacyJwt');

let mongoServer;
let testBranch;
let expiredBranch;
let testOwner;
let ownerToken;
let category;

async function setup() {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 1. Create active branch with subscription
    testBranch = await Branch.create({
        name: 'MediSlip Apex Care Branch',
        code: 'MED-APEX-TEST',
        drug_license_no: 'DL-UP-LKO-2026-98765',
        gstin: '09AAACM1234F1Z5',
        address: 'Shop No. 12-14, Ground Floor, Hazratganj, Lucknow, UP - 226001',
        contact_number: '+91 9876543210',
        pincode: '226001',
        subscription: {
            plan_name: 'ENTERPRISE',
            status: 'ACTIVE',
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            expiry_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days left
            auto_renew: true,
        },
        is_active: true,
    });

    // 2. Create expired branch for BE-004 testing
    expiredBranch = await Branch.create({
        name: 'MediSlip Expired Care Branch',
        code: 'MED-EXP-TEST',
        drug_license_no: 'DL-UP-LKO-2026-11111',
        gstin: '09AAACM1234F1Z5',
        address: 'Shop No. 1, Old Market, Lucknow, UP - 226001',
        contact_number: '+91 9876543211',
        pincode: '226001',
        subscription: {
            plan_name: 'STANDARD',
            status: 'ACTIVE',
            start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            expiry_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Expired 14 days ago
            auto_renew: false,
        },
        is_active: true,
    });

    // 3. Create Owner
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Medcab@123', salt);

    testOwner = await User.create({
        full_name: 'Dr. Test Owner',
        email: 'test_owner@medislip.com',
        phone: '+91 9876543210',
        password_hash: passwordHash,
        role: 'PHARMACY_OWNER',
        branch_id: testBranch._id,
        is_active: true,
    });

    testBranch.owner_id = testOwner._id;
    await testBranch.save();

    ownerToken = generateAccessToken({
        userId: testOwner._id.toString(),
        role: testOwner.role,
        branchId: testBranch._id.toString(),
        ownerId: testOwner._id.toString(),
        features: ['*'],
    });

    // 4. Create Category & Test Medicines
    category = await Category.create({
        name: 'Antibiotics',
        branch_id: testBranch._id,
    });

    // Medicine 1: Low-stock (stock: 3, min_threshold: 10)
    const medLowStock = await Medicine.create({
        branch_id: testBranch._id,
        category_id: category._id,
        name: 'Amoxicillin 500mg',
        sku_barcode: 'AMOX500',
        manufacturer: 'Cipla Ltd',
        dosage_form: 'CAPSULE',
        min_stock_threshold: 10,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: testBranch._id,
        medicine_id: medLowStock._id,
        batch_number: 'AMX-001',
        current_stock: 3,
        purchase_rate: 40,
        mrp: 60,
        sale_price: 55,
        expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        is_active: true,
    });

    // Medicine 2: Expiring soon (stock: 50, expiry in 15 days)
    const medExpiring = await Medicine.create({
        branch_id: testBranch._id,
        category_id: category._id,
        name: 'Azithromycin 250mg',
        sku_barcode: 'AZITH250',
        manufacturer: 'Sun Pharma',
        dosage_form: 'TABLET',
        min_stock_threshold: 5,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: testBranch._id,
        medicine_id: medExpiring._id,
        batch_number: 'AZT-001',
        current_stock: 50,
        purchase_rate: 80,
        mrp: 110,
        sale_price: 100,
        expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        is_active: true,
    });

    // Medicine 3: Already Expired (stock: 20, expired 10 days ago)
    const medExpired = await Medicine.create({
        branch_id: testBranch._id,
        category_id: category._id,
        name: 'Cefixime 200mg',
        sku_barcode: 'CEF200',
        manufacturer: 'Lupin Ltd',
        dosage_form: 'TABLET',
        min_stock_threshold: 5,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: testBranch._id,
        medicine_id: medExpired._id,
        batch_number: 'CEF-001',
        current_stock: 20,
        purchase_rate: 70,
        mrp: 95,
        sale_price: 90,
        expiry_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Expired
        is_active: true,
    });
}

async function runTests() {
    let passed = 0;
    let failed = 0;

    const assert = (condition, desc) => {
        if (condition) {
            console.log(`  ✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${desc}`);
            failed++;
        }
    };

    console.log('\n======================================================');
    console.log('🧪 RUNNING MEDISLIP FIX VERIFICATION SUITE');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST BE-001: Shared Low-Stock and Expiring Count Consistency
    // -------------------------------------------------------------------------
    console.log('--- TEST BE-001: Dashboard vs Alerts Counts Consistency ---');
    const sharedCounts = await inventoryService.getInventoryAlertCounts(testBranch._id, 60);
    const dashboardStats = await reportService.getDashboardStats(testBranch._id);

    assert(
        dashboardStats.inventory_status.low_stock_count === sharedCounts.low_stock_count,
        `Dashboard low-stock (${dashboardStats.inventory_status.low_stock_count}) matches shared counts (${sharedCounts.low_stock_count})`
    );
    assert(
        dashboardStats.inventory_status.expiring_soon_count === sharedCounts.expiring_soon_count,
        `Dashboard expiring-soon (${dashboardStats.inventory_status.expiring_soon_count}) matches shared counts (${sharedCounts.expiring_soon_count})`
    );

    const alertLowRes = await request(app)
        .get('/api/v1/inventory/alerts/low-stock')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(
        alertLowRes.status === 200 && alertLowRes.body.data.length === sharedCounts.low_stock_count,
        `GET /inventory/alerts/low-stock returned ${alertLowRes.body.data.length} items, exactly matching count`
    );

    const alertExpRes = await request(app)
        .get('/api/v1/inventory/alerts/expiring')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(
        alertExpRes.status === 200 && alertExpRes.body.data.length === sharedCounts.expiring_soon_count,
        `GET /inventory/alerts/expiring returned ${alertExpRes.body.data.length} items, exactly matching count`
    );

    // -------------------------------------------------------------------------
    // TEST BE-004: Server-side Subscription Computation & Expiry Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-004: Server-side Subscription Status & Enforcement ---');
    const activeSub = testBranch.getSubscriptionDetails();
    assert(
        activeSub.status === 'ACTIVE' && activeSub.days_left > 0 && activeSub.is_expired === false,
        `Active branch computed: status=${activeSub.status}, days_left=${activeSub.days_left}, is_expired=false`
    );

    const expiredSub = expiredBranch.getSubscriptionDetails();
    assert(
        expiredSub.status === 'EXPIRED' && expiredSub.days_left === 0 && expiredSub.is_expired === true,
        `Expired branch computed: status=${expiredSub.status}, days_left=${expiredSub.days_left}, is_expired=true (never negative or hard-coded)`
    );

    // Expired branch mutation block test
    const expiredToken = generateAccessToken({
        userId: testOwner._id.toString(),
        role: testOwner.role,
        branchId: expiredBranch._id.toString(),
        ownerId: testOwner._id.toString(),
        features: ['*'],
    });

    const expiredMutationRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
            name: 'New Medicine Under Expired Branch',
            sku_barcode: 'TESTEXP123',
            dosage_form: 'TABLET',
        });
    if (expiredMutationRes.status !== 403) {
        console.log('DEBUG expiredMutationRes:', expiredMutationRes.status, expiredMutationRes.body);
    }
    assert(
        expiredMutationRes.status === 403 && expiredMutationRes.body.code === 'SUBSCRIPTION_EXPIRED',
        `Mutation blocked with 403 SUBSCRIPTION_EXPIRED for expired plan (code: ${expiredMutationRes.body.code})`
    );

    // -------------------------------------------------------------------------
    // TEST BE-005: Auth / Session (/auth/me and Account Lockout)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-005: Auth Persistence (/auth/me) & Account Lockout ---');
    const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);

    assert(
        meRes.status === 200 && meRes.body.data.user.email === testOwner.email,
        `GET /auth/me returns authenticated user details (${meRes.body.data.user.email})`
    );
    assert(
        Boolean(meRes.body.data.branch && meRes.body.data.subscription),
        `GET /auth/me returns active branch and live subscription details`
    );

    // Test failed login lockout
    console.log('  Testing 5 consecutive failed logins...');
    for (let i = 0; i < 5; i++) {
        await request(app)
            .post('/api/v1/auth/login')
            .send({ email: testOwner.email, password: 'WrongPassword999!' });
    }
    const lockedRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testOwner.email, password: 'WrongPassword999!' });
    assert(
        lockedRes.status === 423 && lockedRes.body.code === 'ACCOUNT_LOCKED',
        `Account locked out with HTTP 423 ACCOUNT_LOCKED after 5 failed attempts`
    );

    // -------------------------------------------------------------------------
    // TEST BE-002: Field-Level Validation Format & Required vs Format
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-002: Field-Level Validation & Required vs Format ---');
    const emptySkuRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: 'Paracetamol',
            sku_barcode: '',
            dosage_form: 'TABLET',
        });

    assert(
        emptySkuRes.status === 400 && Array.isArray(emptySkuRes.body.errors),
        `Response returns status 400 and top-level errors array`
    );

    const skuError = (emptySkuRes.body.errors || []).find((e) => e.field === 'sku_barcode' || e.field === 'sku');
    assert(
        skuError && skuError.message.includes('required'),
        `Empty SKU returns required message: "${skuError ? skuError.message : ''}"`
    );

    const invalidSkuRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: 'Paracetamol',
            sku_barcode: 'INVALID SKU @@##',
            dosage_form: 'TABLET',
        });
    const invalidSkuErr = (invalidSkuRes.body.errors || []).find((e) => e.field === 'sku_barcode' || e.field === 'sku');
    assert(
        invalidSkuErr && invalidSkuErr.message.includes('alphanumeric'),
        `Invalid SKU returns format message: "${invalidSkuErr ? invalidSkuErr.message : ''}"`
    );

    // -------------------------------------------------------------------------
    // TEST BE-003: Atomic Medicine + Batch Creation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-003: Atomic Medicine + First Batch Creation ---');
    const atomicRes = await request(app)
        .post('/api/v1/inventory/medicines/with-batch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: 'Ibuprofen 400mg',
            category_id: category._id.toString(),
            sku_barcode: 'IBU400ATOMIC',
            manufacturer: 'Abbott',
            dosage_form: 'TABLET',
            min_stock_threshold: 15,
            batch_number: 'IBU-B01',
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            purchase_rate: 20,
            mrp: 35,
            quantity: 100,
        });

    if (atomicRes.status !== 201) {
        console.log('DEBUG atomicRes:', atomicRes.status, atomicRes.body);
    }
    assert(
        atomicRes.status === 201 && atomicRes.body.data.medicine && atomicRes.body.data.batch,
        `POST /inventory/medicines/with-batch created medicine (${atomicRes.body.data?.medicine?.name}) and first batch (${atomicRes.body.data?.batch?.batch_number}) atomically`
    );

    // -------------------------------------------------------------------------
    // TEST BE-007: Returns Subsystem (Pagination, Inspect, Restock)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-007: Real Returns Subsystem & Restock Action ---');
    const testBatchToReturn = await MedicineBatch.findOne({ batch_number: 'AMX-001' });
    const initialStock = testBatchToReturn.current_stock;

    // Create return
    const returnCreateRes = await request(app)
        .post('/api/v1/returns')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            customer_name: 'Rahul Sharma',
            customer_phone: '+91 9876543210',
            items: [
                {
                    batch_id: testBatchToReturn._id.toString(),
                    quantity: 2,
                    reason: 'Unopened excess medicine',
                    condition: 'SEALED',
                    action: 'RESTOCK',
                },
            ],
        });

    assert(
        returnCreateRes.status === 201 && returnCreateRes.body.data.return_number.startsWith('RET-'),
        `Created return request with valid number: ${returnCreateRes.body.data?.return_number}`
    );

    const returnId = returnCreateRes.body.data._id;

    // List returns
    const listReturnsRes = await request(app)
        .get('/api/v1/returns?page=1&limit=10')
        .set('Authorization', `Bearer ${ownerToken}`);

    assert(
        listReturnsRes.status === 200 && listReturnsRes.body.data.returns.length > 0,
        `GET /returns returns real paginated data from DB (total: ${listReturnsRes.body.data.pagination.total})`
    );

    // Restock return
    const restockRes = await request(app)
        .post(`/api/v1/returns/${returnId}/restock`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

    assert(
        restockRes.status === 200 && restockRes.body.data.status === 'RESTOCKED',
        `POST /returns/:id/restock marked status as RESTOCKED`
    );

    const updatedBatch = await MedicineBatch.findById(testBatchToReturn._id);
    assert(
        updatedBatch.current_stock === initialStock + 2,
        `Batch stock accurately incremented from ${initialStock} to ${updatedBatch.current_stock}`
    );

    const stockLog = await StockLog.findOne({ reference_id: returnCreateRes.body.data.return_number });
    assert(
        Boolean(stockLog && stockLog.quantity === 2),
        `Stock audit log generated referencing return number with quantity 2`
    );

    // -------------------------------------------------------------------------
    // TEST FE-008: Expired Stock Exclusion from Sellable Stock
    // -------------------------------------------------------------------------
    console.log('\n--- TEST FE-008: Expired Stock Exclusion from Sellable Stock ---');
    const medListRes = await request(app)
        .get('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${ownerToken}`);

    const expiredMed = (medListRes.body.data.medicines || []).find((m) => m.sku_barcode === 'CEF200');
    assert(
        expiredMed && expiredMed.sellableQty === 0 && expiredMed.expired === true,
        `Expired medicine (CEF200) reports sellableQty: 0 and expired: true despite having physical stock`
    );

    // -------------------------------------------------------------------------
    // TEST BE-008: Store Validation (GSTIN, DL, Address)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-008: Store Profile Validation ---');
    const badStoreRes = await request(app)
        .put('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            gstin: 'BSBVSVSV',
            drug_license_no: 'csffsggsvscc',
            address: 'ggg',
        });

    assert(
        badStoreRes.status === 400 && badStoreRes.body.errors.length >= 3,
        `Invalid GSTIN, Drug License, and short address correctly rejected with ${badStoreRes.body.errors.length} validation errors`
    );

    // -------------------------------------------------------------------------
    // TEST FE-012 & FE-011: Staff Password Safety & Real Telemetry
    // -------------------------------------------------------------------------
    console.log('\n--- TEST FE-012 & FE-011: Staff Password Safety & Real Telemetry ---');
    const defaultPwdStaffRes = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            full_name: 'John Staff',
            email: 'john_staff@medislip.com',
            phone: '+91 9988776655',
            role: 'PHARMACIST',
            password: 'password', // Known default/weak password
        });

    assert(
        defaultPwdStaffRes.status === 400,
        `POST /staff rejects weak/default password 'password'`
    );

    const goodStaffRes = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            full_name: 'Dr. Anita Roy',
            email: 'anita_staff@medislip.com',
            phone: '9988776655',
            role: 'PHARMACIST',
            password: 'SecureStrongPass@2026',
        });

    if (goodStaffRes.status !== 201) {
        console.log('DEBUG goodStaffRes:', goodStaffRes.status, goodStaffRes.body);
    }

    assert(
        goodStaffRes.status === 201 && goodStaffRes.body.data.must_change_password === true,
        `Staff created with must_change_password: true and secure bcrypt hash`
    );

    const staffListRes = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${ownerToken}`);

    const allStaff = Array.isArray(staffListRes.body.data)
        ? staffListRes.body.data
        : (staffListRes.body.data?.staff || staffListRes.body.staff || []);

    const createdStaffMember = allStaff.find((s) => s.email === 'anita_staff@medislip.com');
    assert(
        createdStaffMember && createdStaffMember.battery === null && createdStaffMember.gps === null && createdStaffMember.active_on_counter === null,
        `Device telemetry returns null (not hard-coded 85% or Counter 1) when unobserved`
    );

    // -------------------------------------------------------------------------
    // TEST BE-006: Aggregated Dashboard Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- TEST BE-006: Aggregated Dashboard Performance Endpoint ---');
    const aggDashRes = await request(app)
        .get('/api/v1/reports/dashboard/aggregated')
        .set('Authorization', `Bearer ${ownerToken}`);

    assert(
        aggDashRes.status === 200 &&
        aggDashRes.body.data.dashboard &&
        aggDashRes.body.data.alerts &&
        aggDashRes.body.data.subscription,
        `Aggregated dashboard returned combined stats, alerts, and subscription in a single request`
    );

    console.log('\n======================================================');
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

setup()
    .then(runTests)
    .catch(async (err) => {
        console.error('Fatal test error:', err);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        if (mongoServer) {
            await mongoServer.stop();
        }
        process.exit(1);
    });
