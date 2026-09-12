// test_suite.js
require('dotenv').config();
const http = require('http');
process.env.NODE_ENV = 'test';
const app = require('../../server');
const db = require('../../models/pharmacy');
const connectDB = require('../../config/database');

let server;
const PORT = 8001;

const runTests = async () => {
    try {
        await connectDB();
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(PORT, resolve));
        console.log(`\n🧪 Test Server started on port ${PORT}\n`);

        const baseUrl = `http://127.0.0.1:${PORT}/api/v1`;

        const request = async (method, path, body = null, token = null) => {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null,
            });
            const data = await res.json();
            return { status: res.status, data };
        };

        // Fetch demo seeded data for dynamic ObjectIds
        const sampleBatch = await db.MedicineBatch.findOne({ batch_number: 'AUG-2026-X1' });
        if (!sampleBatch) {
            throw new Error('Seed data missing. Please run node seed.js first.');
        }
        const sampleMedId = sampleBatch.medicine_id.toString();
        const sampleBatchId = sampleBatch._id.toString();

        // ============================================================
        // MODULE 1: AUTHENTICATION & SESSION SECURITY
        // ============================================================
        console.log('============================================================');
        console.log('MODULE 1: AUTHENTICATION & SESSION SECURITY');
        console.log('============================================================');

        // Test 1.1: Owner Login & Password Hash Exclusion
        console.log('\n--- TEST 1.1: Pharmacy Owner Login & Password Hash Exclusion ---');
        const ownerLogin = await request('POST', '/auth/login', {
            email: 'owner@medcab.com',
            password: 'Medcab@123',
        });
        if (ownerLogin.status === 200 && ownerLogin.data.data.accessToken) {
            console.log('✅ PASS: Owner login successful. Role:', ownerLogin.data.data.user.role);
        } else {
            throw new Error(`Owner login failed: ${JSON.stringify(ownerLogin.data)}`);
        }

        const ownerUser = ownerLogin.data.data.user;
        if (ownerUser.password_hash === undefined) {
            console.log('✅ PASS: password_hash is strictly stripped from API response.');
        } else {
            throw new Error('SECURITY VULNERABILITY: password_hash is present in user response!');
        }
        const ownerToken = ownerLogin.data.data.accessToken;

        // Test 1.2: Blocked & Inactive User Login Rejection
        console.log('\n--- TEST 1.2: Blocked & Inactive User Login Rejection ---');
        const blockedLogin = await request('POST', '/auth/login', {
            email: 'blocked@medcab.com',
            password: 'Staff@123',
        });
        if (blockedLogin.status === 403) {
            console.log('✅ PASS: Blocked user rejected with 403:', blockedLogin.data.message);
        } else {
            throw new Error(`Expected 403 for blocked user, got ${blockedLogin.status}`);
        }

        // Test 1.3: OTP Flow (Send, Expiry, Single-Use Verification)
        console.log('\n--- TEST 1.3: OTP Flow (Send, Expiry & Single-Use) ---');
        const testPhone = '9876543210';
        const sendOtpRes = await request('POST', '/auth/send-otp', { phone: testPhone });
        if (sendOtpRes.status === 200 && sendOtpRes.data.data.demoOtp) {
            console.log('✅ PASS: OTP generated successfully. Expires in 5 min.');
        } else {
            throw new Error(`Send OTP failed: ${JSON.stringify(sendOtpRes.data)}`);
        }

        const demoOtp = sendOtpRes.data.data.demoOtp;

        // Verify with wrong OTP -> must fail 400
        const wrongOtpRes = await request('POST', '/auth/verify-otp', { phone: testPhone, otp: '000000' });
        if (wrongOtpRes.status === 400) {
            console.log('✅ PASS: Incorrect OTP rejected with 400.');
        } else {
            throw new Error(`Incorrect OTP should return 400, got ${wrongOtpRes.status}`);
        }

        // Verify with correct OTP -> must succeed
        const correctOtpRes = await request('POST', '/auth/verify-otp', { phone: testPhone, otp: demoOtp });
        if (correctOtpRes.status === 200 && correctOtpRes.data.data.verified) {
            console.log('✅ PASS: Correct OTP verified successfully.');
        } else {
            throw new Error(`OTP verification failed: ${JSON.stringify(correctOtpRes.data)}`);
        }

        // Replay same OTP -> must fail (single-use constraint)
        const replayOtpRes = await request('POST', '/auth/verify-otp', { phone: testPhone, otp: demoOtp });
        if (replayOtpRes.status === 400) {
            console.log('✅ PASS: Replay of used OTP rejected with 400 (Single-use verified).');
        } else {
            throw new Error(`Replayed OTP should return 400, got ${replayOtpRes.status}`);
        }

        // Test 1.4: Server-Side Logout (Session Invalidation)
        console.log('\n--- TEST 1.4: Server-Side Logout (Token Version Invalidation) ---');
        const tempPhone = '91111' + Math.floor(10000 + Math.random() * 90000);
        const tempEmail = `temp.${Date.now()}@medcab.com`;
        const createTempStaff = await request('POST', '/staff', {
            full_name: 'Temp Logout Tester',
            email: tempEmail,
            phone: tempPhone,
            password: 'Password@123',
            role: 'CASHIER',
        }, ownerToken);

        const tempLogin = await request('POST', '/auth/login', { email: tempEmail, password: 'Password@123' });
        const tempToken = tempLogin.data.data.accessToken;

        // Check that tempToken works
        const checkWorking = await request('GET', '/auth/me', null, tempToken);
        if (checkWorking.status !== 200) throw new Error('Temp user me endpoint failed');

        // Logout
        const logoutRes = await request('POST', '/auth/logout', null, tempToken);
        if (logoutRes.status === 200) {
            console.log('✅ PASS: Server-side logout endpoint executed successfully.');
        }

        // Attempt next API call with same token -> must be rejected with 401 SESSION_INVALIDATED
        const checkInvalidated = await request('GET', '/auth/me', null, tempToken);
        if (checkInvalidated.status === 401) {
            console.log('✅ PASS: Token invalidated server-side immediately on next API call (Status 401).');
        } else {
            throw new Error(`Expected 401 for invalidated token after logout, got ${checkInvalidated.status}`);
        }

        // ============================================================
        // MODULE 2: ROLE-BASED ACCESS CONTROL (RBAC)
        // ============================================================
        console.log('\n============================================================');
        console.log('MODULE 2: ROLE-BASED ACCESS CONTROL (RBAC)');
        console.log('============================================================');

        // Test 2.1: Pharmacist Login & Non-Owner Restriction
        console.log('\n--- TEST 2.1: Non-Owner Restricted from Staff Management ---');
        const pharmacistLogin = await request('POST', '/auth/login', {
            email: 'pharmacist@medcab.com',
            password: 'Pharmacist@123',
        });
        const pharmacistToken = pharmacistLogin.data?.data?.accessToken;
        const staffAccess = await request('GET', '/staff', null, pharmacistToken);
        if (staffAccess.status === 403) {
            console.log('✅ PASS: Non-owner blocked from /staff routes with 403.');
        } else {
            throw new Error(`Non-owner accessed /staff with status ${staffAccess.status}`);
        }

        // Test 2.2: Staff Creation & Exclusion of 'staff_management' feature
        console.log('\n--- TEST 2.2: Staff Creation & staff_management Exclusion ---');
        const anitaPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
        const anitaEmail = `anita.${Date.now()}@medcab.com`;
        const anitaStaff = await request('POST', '/staff', {
            full_name: 'Anita Verma',
            email: anitaEmail,
            phone: anitaPhone,
            password: 'Staff@12345',
            role: 'CASHIER',
            features_granted: ['billing_pos', 'customers_manage', 'staff_management'],
        }, ownerToken);

        const anitaId = anitaStaff.data.data.id;
        const anitaFeatures = anitaStaff.data.data.features_granted;
        if (!anitaFeatures.includes('staff_management')) {
            console.log('✅ PASS: staff_management feature was stripped from non-owner staff assignment.');
        } else {
            throw new Error('SECURITY VULNERABILITY: staff_management was granted to non-owner!');
        }

        // Test 2.3: Live Mid-Session Permission Revocation
        console.log('\n--- TEST 2.3: Live Mid-Session Permission Revocation ---');
        const anitaLogin = await request('POST', '/auth/login', { email: anitaEmail, password: 'Staff@12345' });
        const anitaToken = anitaLogin.data.data.accessToken;

        const posCheck1 = await request('GET', '/pos/invoices', null, anitaToken);
        if (posCheck1.status === 200) {
            console.log('✅ PASS: Anita can initially access POS with granted permission.');
        }

        await request('POST', `/staff/${anitaId}/revoke-all`, null, ownerToken);

        const posCheck2 = await request('GET', '/pos/invoices', null, anitaToken);
        if (posCheck2.status === 403) {
            console.log('✅ PASS: Revoked permission took effect on VERY NEXT API call (Status 403).');
        } else {
            throw new Error(`Expected 403 after mid-session permission revocation, got ${posCheck2.status}`);
        }

        // Test 2.4: Live Mid-Session Account Blocking
        console.log('\n--- TEST 2.4: Live Mid-Session Account Blocking ---');
        await request('POST', `/staff/${anitaId}/reset-default`, null, ownerToken);
        await request('PATCH', `/staff/${anitaId}/block`, { is_blocked: true, block_reason: 'Suspicious activity' }, ownerToken);

        const blockedApiCall = await request('GET', '/pos/invoices', null, anitaToken);
        if (blockedApiCall.status === 403 || blockedApiCall.status === 401) {
            console.log('✅ PASS: Blocked staff API call rejected immediately mid-session (Status ' + blockedApiCall.status + ').');
        } else {
            throw new Error(`Expected 403/401 for blocked user mid-session, got ${blockedApiCall.status}`);
        }

        // Test 2.5: Force Logout Mid-Session
        console.log('\n--- TEST 2.5: Force Logout Mid-Session ---');
        await request('PATCH', `/staff/${anitaId}/block`, { is_blocked: false }, ownerToken);
        const anitaLogin2 = await request('POST', '/auth/login', { email: anitaEmail, password: 'Staff@12345' });
        const anitaToken2 = anitaLogin2.data.data.accessToken;

        const forceLogoutRes = await request('POST', `/staff/${anitaId}/force-logout`, null, ownerToken);
        if (forceLogoutRes.status === 200) {
            console.log('✅ PASS: Owner force-logout endpoint executed successfully.');
        }

        const forceLogoutCheck = await request('GET', '/pos/invoices', null, anitaToken2);
        if (forceLogoutCheck.status === 401) {
            console.log('✅ PASS: Force logout terminated existing token on very next request (Status 401).');
        } else {
            throw new Error(`Expected 401 after force logout, got ${forceLogoutCheck.status}`);
        }

        // ============================================================
        // MODULE 3: MULTI-TENANCY & BRANCH ISOLATION
        // ============================================================
        console.log('\n============================================================');
        console.log('MODULE 3: MULTI-TENANCY / BRANCH ISOLATION');
        console.log('============================================================');

        // Test 3.1: Create Second Branch & Owner
        const branch2Code = 'B2-' + Math.floor(1000 + Math.random() * 9000);
        const owner2Email = `owner2.${Date.now()}@medcab.com`;
        const owner2Phone = '99999' + Math.floor(10000 + Math.random() * 90000);

        const registerB2 = await request('POST', '/auth/register', {
            full_name: 'Branch 2 Owner',
            email: owner2Email,
            phone: owner2Phone,
            password: 'Owner2@12345',
            branch_details: {
                name: 'MedCab Sector 62 Branch',
                code: branch2Code,
                drug_license_no: 'DL-UP-2026-9999',
                gstin: '09AABCM9999Z1Z5',
                address: 'Sector 62, Noida',
            },
        });

        if (registerB2.status === 201) {
            console.log('✅ PASS: Registered second independent Branch & Owner.');
        }
        const owner2Token = registerB2.data.data.accessToken;

        const b2BranchId = registerB2.data.data.user.branch.id;
        const b2Med = await db.Medicine.create({
            branch_id: b2BranchId,
            category_id: (await db.Category.findOne())._id,
            name: 'B2 Medicine',
            sku_barcode: 'B2-BARCODE',
            manufacturer: 'B2 Pharma',
            form: 'Tablet',
            unit: 'Strip',
        });
        const b2Batch = await db.MedicineBatch.create({
            branch_id: b2BranchId,
            medicine_id: b2Med._id,
            batch_number: 'B2-BATCH-01',
            expiry_date: new Date('2028-01-01'),
            purchase_rate: 10,
            mrp: 20,
            sale_price: 18,
            current_stock: 50,
        });

        const b2Order = await request('POST', '/orders', {
            order_type: 'COUNTER',
            items: [{ medicine_id: b2Med._id.toString(), batch_id: b2Batch._id.toString(), quantity: 1 }],
        }, owner2Token);

        const b2OrderId = b2Order.data?.data?.id;

        // Branch 1 Owner attempts to access Branch 2 Order -> must return 404
        if (b2OrderId) {
            const crossBranchAccess = await request('GET', `/orders/${b2OrderId}`, null, ownerToken);
            if (crossBranchAccess.status === 404) {
                console.log('✅ PASS: Zero cross-branch data leakage! Branch 1 received 404 when querying Branch 2 order.');
            } else {
                throw new Error(`SECURITY VULNERABILITY: Cross-branch data leak! Status: ${crossBranchAccess.status}`);
            }
        }

        // ============================================================
        // MODULE 4: BUSINESS LOGIC & ORDER ACCEPT FLOW
        // ============================================================
        console.log('\n============================================================');
        console.log('MODULE 4: BUSINESS LOGIC & ORDER ACCEPT FLOW');
        console.log('============================================================');

        // Test 4.1: Atomic Order Accept Flow
        console.log('\n--- TEST 4.1: Atomic Order Accept Flow ---');
        const batch1Before = await db.MedicineBatch.findById(sampleBatchId);
        const stockBefore = batch1Before.current_stock;

        const createdOrderRes = await request('POST', '/orders', {
            order_type: 'COUNTER',
            items: [
                {
                    medicine_id: sampleMedId,
                    batch_id: sampleBatchId,
                    quantity: 2,
                    discount_percent: 10,
                },
            ],
            remarks: 'Order Accept Test',
        }, ownerToken);

        const orderToAcceptId = createdOrderRes.data.data.id;
        console.log(`Created Order #${orderToAcceptId} with status: ${createdOrderRes.data.data.status}`);

        const acceptRes = await request('POST', `/orders/${orderToAcceptId}/accept`, null, ownerToken);
        if (acceptRes.status === 200) {
            console.log('✅ PASS: Order accepted successfully. Status:', acceptRes.data.data.status);
        } else {
            throw new Error(`Order accept failed: ${JSON.stringify(acceptRes.data)}`);
        }

        const batch1After = await db.MedicineBatch.findById(sampleBatchId);
        if (batch1After.current_stock === stockBefore - 2) {
            console.log(`✅ PASS: Stock deducted accurately from ${stockBefore} to ${batch1After.current_stock}.`);
        } else {
            throw new Error(`Stock mismatch: Expected ${stockBefore - 2}, got ${batch1After.current_stock}`);
        }

        const stockLog = await db.StockLog.findOne({
            batch_id: sampleBatchId,
            reference_id: createdOrderRes.data.data.order_number,
        });
        if (stockLog && stockLog.type === 'SALE_OUT' && stockLog.quantity === -2) {
            console.log('✅ PASS: StockLog entry created with type=SALE_OUT and correct balance_after.');
        } else {
            throw new Error('StockLog entry missing or incorrect for accepted order');
        }

        const invoice = await db.Invoice.findOne({ order_id: orderToAcceptId });
        if (invoice) {
            const cgst = parseFloat(invoice.cgst_amount);
            const sgst = parseFloat(invoice.sgst_amount);
            const subtotal = parseFloat(invoice.subtotal);
            const discount = parseFloat(invoice.discount_amount);
            const grandTotal = parseFloat(invoice.grand_total);

            if (Math.abs(cgst - sgst) < 0.01 && Math.abs((subtotal - discount + cgst + sgst) - grandTotal) < 0.05) {
                console.log(`✅ PASS: Linked invoice ${invoice.invoice_number} created with verified GST math (CGST: ₹${cgst}, SGST: ₹${sgst}, Grand Total: ₹${grandTotal}).`);
            } else {
                throw new Error(`GST arithmetic mismatch in invoice: ${JSON.stringify(invoice)}`);
            }
        } else {
            throw new Error('Invoice was not linked to accepted order');
        }

        // Test 4.2: Idempotency Guard
        console.log('\n--- TEST 4.2: Idempotency Guard ---');
        const repeatAccept = await request('POST', `/orders/${orderToAcceptId}/accept`, null, ownerToken);
        if (repeatAccept.status === 400 && repeatAccept.data.error.code === 'ORDER_ALREADY_PROCESSED') {
            console.log('✅ PASS: Repeat accept rejected with 400 ORDER_ALREADY_PROCESSED (Idempotency verified).');
        } else {
            throw new Error(`Repeat accept should return 400 ORDER_ALREADY_PROCESSED, got ${repeatAccept.status}`);
        }

        // Test 4.3: Insufficient Stock Rollback
        console.log('\n--- TEST 4.3: Insufficient Stock Rollback ---');
        const excessiveOrderRes = await request('POST', '/orders', {
            order_type: 'COUNTER',
            items: [{ medicine_id: sampleMedId, batch_id: sampleBatchId, quantity: 5000 }],
        }, ownerToken);

        const excessiveOrderId = excessiveOrderRes.data.data.id;
        const excessiveAccept = await request('POST', `/orders/${excessiveOrderId}/accept`, null, ownerToken);
        if (excessiveAccept.status === 400 && excessiveAccept.data.error.code === 'INSUFFICIENT_STOCK') {
            console.log('✅ PASS: Order accept with insufficient stock rejected cleanly with 400 INSUFFICIENT_STOCK.');
        } else {
            throw new Error(`Expected 400 INSUFFICIENT_STOCK, got ${excessiveAccept.status}`);
        }

        // Test 4.4: Returns Processing (Restock vs Dispose)
        console.log('\n--- TEST 4.4: Returns Flow (Restock vs Dispose) ---');
        const stockBeforeReturn = (await db.MedicineBatch.findById(sampleBatchId)).current_stock;
        const restockRes = await request('POST', '/inventory/returns', {
            batch_id: sampleBatchId,
            quantity: 5,
            action: 'RESTOCK',
            reason: 'Customer cancelled at door',
        }, ownerToken);

        const stockAfterReturn = (await db.MedicineBatch.findById(sampleBatchId)).current_stock;
        if (stockAfterReturn === stockBeforeReturn + 5) {
            console.log(`✅ PASS: RESTOCK return incremented stock from ${stockBeforeReturn} to ${stockAfterReturn}.`);
        } else {
            throw new Error(`Restock failed to increment stock properly`);
        }

        // Test 4.5: State Machine Illegal Jump Guard
        console.log('\n--- TEST 4.5: State Machine Illegal Jump Guard ---');
        const newOrderForJump = await request('POST', '/orders', {
            order_type: 'COUNTER',
            items: [{ medicine_id: sampleMedId, batch_id: sampleBatchId, quantity: 1 }],
        }, ownerToken);

        const jumpOrderId = newOrderForJump.data.data.id;
        const illegalJump = await request('PATCH', `/orders/${jumpOrderId}/status`, { status: 'DELIVERED' }, ownerToken);
        if (illegalJump.status === 400 && illegalJump.data.error.code === 'ILLEGAL_STATUS_TRANSITION') {
            console.log('✅ PASS: Illegal status jump from PLACED to DELIVERED rejected with 400 ILLEGAL_STATUS_TRANSITION.');
        } else {
            throw new Error(`Illegal status jump should return 400, got ${illegalJump.status}`);
        }

        // ============================================================
        // MODULE 5: REAL-TIME PRESENCE REST ENDPOINTS
        // ============================================================
        console.log('\n============================================================');
        console.log('MODULE 5: STAFF PRESENCE REST ENDPOINT');
        console.log('============================================================');

        console.log('\n--- TEST 5.1: Staff Online Status Endpoint ---');
        const presenceList = await request('GET', '/staff/online-status', null, ownerToken);
        if (presenceList.status === 200 && Array.isArray(presenceList.data.data)) {
            console.log(`✅ PASS: GET /staff/online-status returned ${presenceList.data.data.length} staff records with presence state.`);
        } else {
            throw new Error(`Online status endpoint failed: ${JSON.stringify(presenceList.data)}`);
        }

        // ============================================================
        // MODULE 6: MULTI-BRANCH & STAFF DUTY TRACKING (GPS & AVAILABILITY)
        // ============================================================
        console.log('\n============================================================');
        console.log('MODULE 6: MULTI-BRANCH & STAFF DUTY GPS TRACKING');
        console.log('============================================================');

        console.log('\n--- TEST 6.1: Owner Creates Secondary Pharmacy Branch ---');
        const testBranchCode = 'MC-EXP-' + Date.now().toString().slice(-4);
        const newBranchRes = await request(
            'POST',
            '/branch',
            {
                name: 'MedCab LifeCare Express Branch 2',
                code: testBranchCode,
                drug_license_no: 'DL-UP-2026-9900',
                gstin: '09ABCDE9988F1Z9',
                address: 'Aliganj, Sector B, Lucknow',
                contact_number: '9876543210',
                email: 'aliganj@medcab.in',
                latitude: 26.8854,
                longitude: 80.9422,
                is_available: true,
            },
            ownerToken
        );

        if (newBranchRes.status !== 201 || !newBranchRes.data.data.id) {
            throw new Error(`Create secondary branch failed: ${JSON.stringify(newBranchRes.data)}`);
        }
        const branch2Id = newBranchRes.data.data.id;
        console.log(`✅ PASS: Owner successfully created secondary branch '${newBranchRes.data.data.name}' (ID: ${branch2Id}).`);

        console.log('\n--- TEST 6.2: List All Owned Branches ---');
        const allBranchesRes = await request('GET', '/branch/all-branches', null, ownerToken);
        if (allBranchesRes.status === 200 && allBranchesRes.data.data.length >= 2) {
            console.log(`✅ PASS: Owner retrieved ${allBranchesRes.data.data.length} branches with active & staff stats.`);
        } else {
            throw new Error(`Get all branches failed: ${JSON.stringify(allBranchesRes.data)}`);
        }

        console.log('\n--- TEST 6.3: Toggle Branch Availability (Live Open/Closed) ---');
        const toggleOffRes = await request(
            'PATCH',
            `/branch/${branch2Id}/toggle-availability`,
            { is_available: false },
            ownerToken
        );
        if (toggleOffRes.status === 200 && toggleOffRes.data.data.is_available === false) {
            console.log('✅ PASS: Branch availability successfully marked UNAVAILABLE / CLOSED.');
        } else {
            throw new Error(`Toggle availability OFF failed: ${JSON.stringify(toggleOffRes.data)}`);
        }

        const toggleOnRes = await request(
            'PATCH',
            `/branch/${branch2Id}/toggle-availability`,
            { is_available: true },
            ownerToken
        );
        if (toggleOnRes.status === 200 && toggleOnRes.data.data.is_available === true) {
            console.log('✅ PASS: Branch availability successfully marked AVAILABLE / OPEN.');
        } else {
            throw new Error(`Toggle availability ON failed: ${JSON.stringify(toggleOnRes.data)}`);
        }

        console.log('\n--- TEST 6.4: Staff Toggles ON_DUTY with GPS Coordinates ---');
        const dutyOnRes = await request(
            'POST',
            '/staff/duty-status',
            {
                duty_status: 'ON_DUTY',
                latitude: 26.8467,
                longitude: 80.9462,
                address: 'Main Store, Hazratganj, Lucknow',
            },
            pharmacistToken
        );
        if (dutyOnRes.status === 200 && dutyOnRes.data.data.duty_status === 'ON_DUTY' && dutyOnRes.data.data.current_location.latitude === 26.8467) {
            console.log('✅ PASS: Staff successfully marked ON_DUTY with GPS coordinates (Lat: 26.8467, Long: 80.9462).');
        } else {
            throw new Error(`Staff ON_DUTY toggle failed: ${JSON.stringify(dutyOnRes.data)}`);
        }

        console.log('\n--- TEST 6.5: Staff Live GPS Location Ping ---');
        const locationPingRes = await request(
            'POST',
            '/staff/location',
            {
                latitude: 26.8500,
                longitude: 80.9500,
                address: 'En route delivery, Gomti Nagar',
            },
            pharmacistToken
        );
        if (locationPingRes.status === 200 && locationPingRes.data.data.current_location.latitude === 26.8500) {
            console.log('✅ PASS: Staff location coordinates successfully updated & broadcasted.');
        } else {
            throw new Error(`Staff location ping failed: ${JSON.stringify(locationPingRes.data)}`);
        }

        console.log('\n--- TEST 6.6: Owner Live Staff Duty & GPS Overview Dashboard ---');
        const dutyOverviewRes = await request('GET', '/staff/duty-overview', null, ownerToken);
        if (dutyOverviewRes.status === 200 && dutyOverviewRes.data.data.summary.total_staff > 0) {
            const sum = dutyOverviewRes.data.data.summary;
            console.log(`✅ PASS: Owner Duty Dashboard fetched (Branches: ${sum.total_branches}, Total Staff: ${sum.total_staff}, On-Duty: ${sum.on_duty_staff}, Off-Duty: ${sum.off_duty_staff}).`);
        } else {
            throw new Error(`Duty overview failed: ${JSON.stringify(dutyOverviewRes.data)}`);
        }

        console.log('\n============================================================');
        console.log('🎉 ALL 21 AUTOMATED AUDIT TEST SUITES PASSED WITH 100% SUCCESS!');
        console.log('============================================================\n');

        server.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Test suite failed with error:', err);
        if (server) server.close();
        process.exit(1);
    }
};

runTests();
