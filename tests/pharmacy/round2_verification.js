/**
 * tests/pharmacy/round2_verification.js
 * 
 * Round 2 Verification Suite:
 * - OB-01: Shared getStockCounts(branchId) consistency across dashboard & inventory endpoints with expired batches (Dolo scenario)
 * - OB-04: Unambiguous staff fields (totalStaff, onDutyNow, blocked, inactive) across dashboard and staff endpoints
 * - OB-05: Store validation (min 10 chars, non-numeric, 6-digit pincode, phone, GSTIN, drug license) & store name/city in responses
 * - OB-06: Plan enforcement (ACTIVE, EXPIRING_SOON, GRACE, EXPIRED), read-only mode for reads, write blocking with PLAN_EXPIRED
 * - Unverified audit checks (atomicity, medicine validations)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const app = require('../../server');
const { Branch, User, Category, Medicine, MedicineBatch } = require('../../models/pharmacy');
const inventoryService = require('../../services/pharmacy/inventory.service');
const staffService = require('../../services/pharmacy/staff.service');
const reportService = require('../../services/pharmacy/report.service');
const { generateAccessToken } = require('../../config/pharmacyJwt');

let mongoServer;
let activeBranch;
let graceBranch;
let expiredBranch;
let testOwner;
let ownerToken;
let expiredToken;
let testCategory;

async function setupDatabase() {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 1. Create Active Branch (45 days left)
    activeBranch = await Branch.create({
        name: 'MediSlip Apex Care Lucknow',
        code: 'MED-APEX-R2',
        drug_license_no: 'DL-UP-LKO-2026-98765',
        gstin: '09AAACM1234F1Z5',
        address: 'Shop No. 12-14, Ground Floor, Hazratganj, Lucknow, UP - 226001',
        city: 'Lucknow',
        contact_number: '+91 9876543210',
        pincode: '226001',
        subscription: {
            plan_name: 'ENTERPRISE',
            status: 'ACTIVE',
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            expiry_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            auto_renew: true,
        },
        is_active: true,
    });

    // 2. Create Expired Branch (Expired 10 days ago, grace 0)
    expiredBranch = await Branch.create({
        name: 'MediSlip Expired Branch',
        code: 'MED-EXP-R2',
        drug_license_no: 'DL-UP-LKO-2026-11111',
        gstin: '09AAACM1234F1Z5',
        address: 'Shop 5, Old Market, Gomti Nagar, Lucknow, UP - 226010',
        city: 'Lucknow',
        contact_number: '+91 9876543211',
        pincode: '226010',
        subscription: {
            plan_name: 'STANDARD',
            status: 'EXPIRED',
            start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            expiry_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            auto_renew: false,
        },
        is_active: true,
    });

    // 3. Create Grace Branch (Expired 2 days ago, grace window 5 days)
    graceBranch = await Branch.create({
        name: 'MediSlip Grace Branch',
        code: 'MED-GRC-R2',
        drug_license_no: 'DL-UP-LKO-2026-22222',
        gstin: '09AAACM1234F1Z5',
        address: 'Shop 88, Civil Lines, Kanpur, UP - 208001',
        city: 'Kanpur',
        contact_number: '+91 9876543212',
        pincode: '208001',
        subscription: {
            plan_name: 'PROFESSIONAL',
            status: 'ACTIVE',
            start_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            expiry_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Expired 2 days ago
            auto_renew: false,
        },
        is_active: true,
    });

    // 4. Create Owner User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Medcab@123', salt);

    testOwner = await User.create({
        full_name: 'Dr. Anurag Tiwari (Owner)',
        email: 'owner@medislip.com',
        phone: '+91 9876543210',
        password_hash: passwordHash,
        role: 'PHARMACY_OWNER',
        branch_id: activeBranch._id,
        is_active: true,
    });

    activeBranch.owner_id = testOwner._id;
    await activeBranch.save();

    ownerToken = generateAccessToken({
        userId: testOwner._id.toString(),
        role: testOwner.role,
        branchId: activeBranch._id.toString(),
        ownerId: testOwner._id.toString(),
        features: ['*'],
    });

    expiredToken = generateAccessToken({
        userId: testOwner._id.toString(),
        role: testOwner.role,
        branchId: expiredBranch._id.toString(),
        ownerId: testOwner._id.toString(),
        features: ['*'],
    });

    // 5. Create Category
    testCategory = await Category.create({
        name: 'General Medicines',
        branch_id: activeBranch._id,
    });

    // 6. Setup Inventory for OB-01 (including the Dolo 44-strip expired batch scenario)
    // Med 1: Low-stock (current sellable stock: 3 <= threshold 10)
    const medLow = await Medicine.create({
        branch_id: activeBranch._id,
        category_id: testCategory._id,
        name: 'Amoxicillin 500mg',
        sku_barcode: 'AMOX500',
        low_stock_threshold: 10,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: activeBranch._id,
        medicine_id: medLow._id,
        batch_number: 'AMX-001',
        current_stock: 3,
        purchase_rate: 40,
        mrp: 60,
        sale_price: 55,
        expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        is_active: true,
    });

    // Med 2: Expiring soon (stock: 50, expiry in 15 days, sellable stock 50 > threshold 10)
    const medExpiring = await Medicine.create({
        branch_id: activeBranch._id,
        category_id: testCategory._id,
        name: 'Azithromycin 250mg',
        sku_barcode: 'AZITH250',
        low_stock_threshold: 10,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: activeBranch._id,
        medicine_id: medExpiring._id,
        batch_number: 'AZT-001',
        current_stock: 50,
        purchase_rate: 80,
        mrp: 110,
        sale_price: 100,
        expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days left
        is_active: true,
    });

    // Med 3: DOLO SCENARIO: 44 non-sellable strips in an EXPIRED batch
    // Physical stock is 44, but sellable quantity is 0!
    // Since sellable quantity 0 <= threshold 20, it is LOW STOCK and OUT OF STOCK!
    // The batch itself has expired, so it must ONLY be counted in expiredCount (NOT in expiringSoonCount)!
    const medDolo = await Medicine.create({
        branch_id: activeBranch._id,
        category_id: testCategory._id,
        name: 'Dolo 650 Tablet',
        sku_barcode: 'DOLO650',
        low_stock_threshold: 20,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: activeBranch._id,
        medicine_id: medDolo._id,
        batch_number: 'DL-EXP-44',
        current_stock: 44, // 44 expired non-sellable strips
        purchase_rate: 20,
        mrp: 34,
        sale_price: 32,
        expiry_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Expired 15 days ago
        is_active: true,
    });

    // Med 4: Sufficient normal stock (stock: 100, expiry in 300 days)
    const medNormal = await Medicine.create({
        branch_id: activeBranch._id,
        category_id: testCategory._id,
        name: 'Paracetamol 500mg',
        sku_barcode: 'PARA500',
        low_stock_threshold: 15,
        is_active: true,
    });
    await MedicineBatch.create({
        branch_id: activeBranch._id,
        medicine_id: medNormal._id,
        batch_number: 'PAR-100',
        current_stock: 100,
        purchase_rate: 10,
        mrp: 20,
        sale_price: 18,
        expiry_date: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
        is_active: true,
    });

    // 7. Setup Staff for OB-04
    // Staff 1: Pharmacist On Duty
    await User.create({
        full_name: 'Rahul Sharma (Pharmacist)',
        email: 'rahul.pharmacist@medislip.com',
        phone: '+91 9876500111',
        password_hash: passwordHash,
        role: 'PHARMACIST',
        branch_id: activeBranch._id,
        duty_status: 'ON_DUTY',
        is_active: true,
        is_blocked: false,
    });

    // Staff 2: Cashier Off Duty
    await User.create({
        full_name: 'Priya Verma (Cashier)',
        email: 'priya.cashier@medislip.com',
        phone: '+91 9876500222',
        password_hash: passwordHash,
        role: 'CASHIER',
        branch_id: activeBranch._id,
        duty_status: 'OFF_DUTY',
        is_active: true,
        is_blocked: false,
    });

    // Staff 3: Blocked Staff
    await User.create({
        full_name: 'Amit Blocked (Staff)',
        email: 'amit.blocked@medislip.com',
        phone: '+91 9876500333',
        password_hash: passwordHash,
        role: 'CASHIER',
        branch_id: activeBranch._id,
        duty_status: 'OFF_DUTY',
        is_active: true,
        is_blocked: true,
        block_reason: 'Policy violation',
    });

    // Staff 4: Inactive Staff
    await User.create({
        full_name: 'Sunil Inactive (Staff)',
        email: 'sunil.inactive@medislip.com',
        phone: '+91 9876500444',
        password_hash: passwordHash,
        role: 'PICKER_PACKER',
        branch_id: activeBranch._id,
        duty_status: 'OFF_DUTY',
        is_active: false,
        is_blocked: false,
    });
}

async function runRound2Tests() {
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

    console.log('\n===============================================================');
    console.log('🧪 MEDISLIP ROUND 2 QA VERIFICATION SUITE');
    console.log('===============================================================\n');

    // =========================================================================
    // TEST OB-01: Shared getStockCounts(branchId) & Dolo Expired Batch Rule
    // =========================================================================
    console.log('--- TEST OB-01: Shared getStockCounts and Dolo Expired Batch Rule ---');

    const singleSourceCounts = await inventoryService.getStockCounts(activeBranch._id, 60);

    // Rule 1: Dolo has 44 strips expired -> sellable stock is 0 <= 20, so lowStockCount = 2 (Amox + Dolo)
    assert(singleSourceCounts.lowStockCount === 2, `lowStockCount is 2 (includes Dolo whose sellable stock is 0): got ${singleSourceCounts.lowStockCount}`);
    assert(singleSourceCounts.outOfStockCount === 1, `outOfStockCount is 1 (Dolo has 0 sellable strips): got ${singleSourceCounts.outOfStockCount}`);

    // Rule 2: Expiring soon has 1 batch (Azithromycin in 15 days), expired batch (Dolo) is NOT in expiring soon
    assert(singleSourceCounts.expiringSoonCount === 1, `expiringSoonCount is 1 (Azithromycin only, Dolo excluded): got ${singleSourceCounts.expiringSoonCount}`);

    // Rule 3: Expired batches counted only in expiredCount
    assert(singleSourceCounts.expiredCount === 1, `expiredCount is 1 (Dolo expired batch): got ${singleSourceCounts.expiredCount}`);

    // Test endpoint 1: GET /reports/dashboard
    const dashboardRes = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(dashboardRes.status === 200, 'GET /reports/dashboard returned 200');
    assert(
        dashboardRes.body.data.low_stock_count === singleSourceCounts.lowStockCount &&
        dashboardRes.body.data.expiring_soon_count === singleSourceCounts.expiringSoonCount &&
        dashboardRes.body.data.out_of_stock_count === singleSourceCounts.outOfStockCount &&
        dashboardRes.body.data.expired_count === singleSourceCounts.expiredCount,
        'Dashboard endpoint returns exact matching counts from getStockCounts'
    );

    // Test endpoint 2: GET /reports/dashboard/aggregated
    const aggRes = await request(app)
        .get('/api/v1/reports/dashboard/aggregated')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(aggRes.status === 200, 'GET /reports/dashboard/aggregated returned 200');
    assert(
        aggRes.body.data.alerts.low_stock_count === singleSourceCounts.lowStockCount &&
        aggRes.body.data.alerts.expiring_soon_count === singleSourceCounts.expiringSoonCount &&
        aggRes.body.data.alerts.out_of_stock_count === singleSourceCounts.outOfStockCount &&
        aggRes.body.data.alerts.expired_count === singleSourceCounts.expiredCount,
        'Aggregated dashboard endpoint returns exact matching counts'
    );

    // Test endpoint 3: GET /inventory/alerts/low-stock
    const alertLowRes = await request(app)
        .get('/api/v1/inventory/alerts/low-stock')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(alertLowRes.status === 200, 'GET /inventory/alerts/low-stock returned 200');
    assert(
        alertLowRes.body.data.length === singleSourceCounts.lowStockCount &&
        alertLowRes.body.lowStockCount === singleSourceCounts.lowStockCount,
        `GET /inventory/alerts/low-stock data length (${alertLowRes.body.data.length}) matches getStockCounts (${singleSourceCounts.lowStockCount})`
    );

    // Test endpoint 4: GET /inventory/alerts/expiring
    const alertExpRes = await request(app)
        .get('/api/v1/inventory/alerts/expiring')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(alertExpRes.status === 200, 'GET /inventory/alerts/expiring returned 200');
    assert(
        alertExpRes.body.data.length === singleSourceCounts.expiringSoonCount &&
        alertExpRes.body.expiringSoonCount === singleSourceCounts.expiringSoonCount,
        `GET /inventory/alerts/expiring data length (${alertExpRes.body.data.length}) matches getStockCounts (${singleSourceCounts.expiringSoonCount})`
    );

    // Test endpoint 5: GET /inventory/summary
    const summaryRes = await request(app)
        .get('/api/v1/inventory/summary')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(summaryRes.status === 200, 'GET /inventory/summary returned 200');
    assert(
        summaryRes.body.data.lowStockCount === singleSourceCounts.lowStockCount &&
        summaryRes.body.data.outOfStockCount === singleSourceCounts.outOfStockCount &&
        summaryRes.body.data.expiringSoonCount === singleSourceCounts.expiringSoonCount &&
        summaryRes.body.data.expiredCount === singleSourceCounts.expiredCount,
        'GET /inventory/summary returns identical stock counts'
    );

    // =========================================================================
    // TEST OB-04: Staff Counts Consistency & Unambiguous Fields
    // =========================================================================
    console.log('\n--- TEST OB-04: Staff Counts & Unambiguous Fields ---');

    const staffCounts = await staffService.getStaffCounts(activeBranch._id);
    assert(staffCounts.totalStaff === 4, `totalStaff is 4 (owner excluded, 4 staff members): got ${staffCounts.totalStaff}`);
    assert(staffCounts.onDutyNow === 1, `onDutyNow is 1 (Rahul on duty): got ${staffCounts.onDutyNow}`);
    assert(staffCounts.blocked === 1, `blocked is 1 (Amit blocked): got ${staffCounts.blocked}`);
    assert(staffCounts.inactive === 1, `inactive is 1 (Sunil inactive): got ${staffCounts.inactive}`);

    // Verify /staff endpoint returns unambiguous fields
    const staffListRes = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(staffListRes.status === 200, 'GET /staff returned 200');
    assert(
        staffListRes.body.totalStaff === staffCounts.totalStaff &&
        staffListRes.body.onDutyNow === staffCounts.onDutyNow &&
        staffListRes.body.blocked === staffCounts.blocked &&
        staffListRes.body.inactive === staffCounts.inactive,
        `GET /staff returns unambiguous fields: totalStaff=${staffListRes.body.totalStaff}, onDutyNow=${staffListRes.body.onDutyNow}, blocked=${staffListRes.body.blocked}, inactive=${staffListRes.body.inactive}`
    );

    // Verify /reports/dashboard returns same unambiguous fields
    assert(
        dashboardRes.body.data.totalStaff === staffCounts.totalStaff &&
        dashboardRes.body.data.onDutyNow === staffCounts.onDutyNow &&
        dashboardRes.body.data.blocked === staffCounts.blocked &&
        dashboardRes.body.data.inactive === staffCounts.inactive,
        `Dashboard returns matching staff fields: totalStaff=${dashboardRes.body.data.totalStaff}, onDutyNow=${dashboardRes.body.data.onDutyNow}, blocked=${dashboardRes.body.data.blocked}`
    );

    // =========================================================================
    // TEST OB-05: Store Data Validation & Store Name/City Response
    // =========================================================================
    console.log('\n--- TEST OB-05: Store Data Validation & City/Name Fields ---');

    // 1. Reject address "ggg" (< 10 chars)
    const shortAddressRes = await request(app)
        .put('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ address: 'ggg' });
    assert(shortAddressRes.status === 400, 'Address "ggg" rejected with HTTP 400');

    // 2. Reject numeric-only address "556666666"
    const numericAddressRes = await request(app)
        .put('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ address: '556666666' });
    assert(numericAddressRes.status === 400, 'Address "556666666" rejected as numeric only with HTTP 400');
    const numericErr = (numericAddressRes.body.errors || []).find(e => e.message.includes('numeric only') || e.message.includes('Address'));
    assert(Boolean(numericErr), `Field-level error returned for numeric-only address: "${numericErr?.message}"`);

    // 3. Reject invalid pincode "12345" (not 6 digits)
    const invalidPinRes = await request(app)
        .put('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ pincode: '12345' });
    assert(invalidPinRes.status === 400, 'Invalid 5-digit pincode rejected with HTTP 400');

    // 4. Reject invalid GSTIN
    const invalidGstinRes = await request(app)
        .put('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ gstin: 'INVALID_GSTIN_123' });
    assert(invalidGstinRes.status === 400, 'Invalid GSTIN rejected with HTTP 400');

    // 5. Valid store update with city and proper address
    const validUpdateRes = await request(app)
        .put('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            address: 'Shop 10, New Care Market, Hazratganj, Lucknow, UP - 226001',
            city: 'Lucknow',
            pincode: '226001',
        });
    assert(validUpdateRes.status === 200, 'Valid branch update succeeded with HTTP 200');

    // 6. Verify dashboard and branch endpoints return store name and city
    const branchRes = await request(app)
        .get('/api/v1/branch/my-branch')
        .set('Authorization', `Bearer ${ownerToken}`);
    assert(
        Boolean(branchRes.body.data.store_name || branchRes.body.data.name) &&
        Boolean(branchRes.body.data.city),
        `GET /branch/my-branch returns store name ("${branchRes.body.data.store_name || branchRes.body.data.name}") and city ("${branchRes.body.data.city}")`
    );
    assert(
        Boolean(dashboardRes.body.data.store_name) && Boolean(dashboardRes.body.data.city),
        `GET /reports/dashboard returns store_name ("${dashboardRes.body.data.store_name}") and city ("${dashboardRes.body.data.city}")`
    );

    // =========================================================================
    // TEST OB-06: Plan Enforcement & Read-Only Mode
    // =========================================================================
    console.log('\n--- TEST OB-06: Plan Enforcement, Grace Period & Read-Only Mode ---');

    // 1. ACTIVE plan subscription details
    const activeSub = activeBranch.getSubscriptionDetails();
    assert(
        activeSub.status === 'ACTIVE' && activeSub.daysLeft > 7 && activeSub.isReadOnly === false,
        `ACTIVE branch: status=${activeSub.status}, daysLeft=${activeSub.daysLeft}, isReadOnly=false`
    );

    // 2. EXPIRING_SOON plan (expiry in 4 days)
    const expiringBranch = await Branch.create({
        name: 'Expiring Soon Branch',
        code: 'MED-EXPIRING-SOON',
        drug_license_no: 'DL-UP-LKO-2026-33333',
        gstin: '09AAACM1234F1Z5',
        address: 'Shop 20, Gomti Nagar, Lucknow, UP - 226010',
        pincode: '226010',
        contact_number: '+91 9876543213',
        subscription: {
            plan_name: 'STANDARD',
            status: 'ACTIVE',
            expiry_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days left
        },
        is_active: true,
    });
    const expSoonSub = expiringBranch.getSubscriptionDetails();
    assert(
        expSoonSub.status === 'EXPIRING_SOON' && expSoonSub.daysLeft === 4 && expSoonSub.isReadOnly === false,
        `EXPIRING_SOON branch: status=${expSoonSub.status}, daysLeft=${expSoonSub.daysLeft}, isReadOnly=false`
    );

    // 3. GRACE period calculation (expired 2 days ago, PLAN_GRACE_DAYS=5)
    process.env.PLAN_GRACE_DAYS = '5';
    const graceSub = graceBranch.getSubscriptionDetails();
    assert(
        graceSub.status === 'GRACE' && graceSub.graceDaysLeft === 3 && graceSub.isReadOnly === false,
        `GRACE branch: status=${graceSub.status}, graceDaysLeft=${graceSub.graceDaysLeft}, isReadOnly=false`
    );
    delete process.env.PLAN_GRACE_DAYS;

    // 4. EXPIRED plan calculation
    const expSub = expiredBranch.getSubscriptionDetails();
    assert(
        expSub.status === 'EXPIRED' && expSub.daysLeft === 0 && expSub.isReadOnly === true,
        `EXPIRED branch: status=${expSub.status}, daysLeft=0, isReadOnly=true`
    );

    // 5. Read-only mode test on expired branch: READS must succeed (200 OK)
    const expiredReadRes = await request(app)
        .get('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${expiredToken}`);
    assert(expiredReadRes.status === 200, 'GET /inventory/medicines allows read access in read-only mode for expired plan');

    const expiredDashboardRes = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`);
    assert(expiredDashboardRes.status === 200, 'GET /reports/dashboard allows read access for expired plan');

    // 6. Write operations must be BLOCKED with 403 and code "PLAN_EXPIRED"
    const expiredWriteMedicineRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
            name: 'Blocked Paracetamol',
            sku_barcode: 'BLOCKED01',
            form: 'Tablet',
        });
    assert(
        expiredWriteMedicineRes.status === 403 && expiredWriteMedicineRes.body.code === 'PLAN_EXPIRED',
        `POST /inventory/medicines blocked with HTTP 403 and code="PLAN_EXPIRED": got ${expiredWriteMedicineRes.body.code}`
    );
    assert(
        expiredWriteMedicineRes.body.message === 'Your plan has expired. Renew to continue.',
        `Blocked response message matches requirement: "${expiredWriteMedicineRes.body.message}"`
    );

    const expiredWriteStaffRes = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
            full_name: 'Blocked Staff',
            email: 'blocked.staff@medislip.com',
            phone: '+91 9876599999',
            password: 'ValidPassword123!',
            role: 'CASHIER',
        });
    assert(
        expiredWriteStaffRes.status === 403 && expiredWriteStaffRes.body.code === 'PLAN_EXPIRED',
        `POST /staff blocked with HTTP 403 and code="PLAN_EXPIRED" on expired branch`
    );

    // 7. Subscription renewal route must be EXEMPT and succeed
    const renewRes = await request(app)
        .post('/api/v1/branch/subscription/renew')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ days: 30, plan: 'ENTERPRISE' });
    assert(renewRes.status === 200, 'POST /branch/subscription/renew is exempt from planGuard and succeeds');
    assert(renewRes.body.data.status === 'ACTIVE', `Renewed branch status is now ACTIVE: got ${renewRes.body.data.status}`);

    // =========================================================================
    // TEST AUDIT ITEMS: Atomicity & Medicine Validation
    // =========================================================================
    console.log('\n--- TEST AUDIT: Atomicity & Medicine Validations ---');

    // Atomicity: POST /inventory/medicines with batch details
    const atomicRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: 'Atomic Test Medicine',
            sku_barcode: 'ATOMIC100',
            batch_number: 'ATM-001',
            expiry_date: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            purchase_rate: 50,
            mrp: 80,
    assert(atomicRes.status === 201, 'POST /inventory/medicines with batch details created atomically');

    // Validation: Expiry date in the past
    const pastExpiryRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: 'Past Expiry Medicine',
            sku_barcode: 'PASTEXP10',
            batch_number: 'PST-001',
            expiry_date: '2020-01-01',
            purchase_rate: 50,
            mrp: 80,
        });
    assert(pastExpiryRes.status === 400, 'Medicine with past expiry date rejected with HTTP 400');

    // Validation: MRP < purchase price
    const mrpLessThanCostRes = await request(app)
        .post('/api/v1/inventory/medicines')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
            name: 'Invalid Price Medicine',
            sku_barcode: 'INVPRC10',
            batch_number: 'INV-001',
            expiry_date: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            purchase_rate: 100,
            mrp: 80, // MRP less than purchase rate!
        });
    assert(mrpLessThanCostRes.status === 400, 'Medicine with MRP < purchase rate rejected with HTTP 400');

    console.log('\n===============================================================');
    console.log(`ROUND 2 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();

    if (failed > 0) {
        process.exit(1);
    }
}

async function main() {
    try {
        await setupDatabase();
        await runRound2Tests();
    } catch (err) {
        console.error('Fatal error in Round 2 verification test:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { runRound2Tests };
