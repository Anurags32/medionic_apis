require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');
const db = require('../models/pharmacy');
const {
    ROLES,
    DEFAULT_ROLE_PERMISSIONS,
    ORDER_STATUS,
    ORDER_TYPES,
    ORDER_TYPE,
    PAYMENT_MODES,
    PAYMENT_STATUS,
    PRESCRIPTION_STATUS,
} = require('../config/pharmacyConstants');

const seedDatabase = async () => {
    try {
        console.log('🔄 Connecting to MongoDB for Seeding...');
        await connectDB();

        // Drop all existing collections for clean demo seeding
        await Promise.all([
            db.Branch.deleteMany({}),
            db.User.deleteMany({}),
            db.Category.deleteMany({}),
            db.Medicine.deleteMany({}),
            db.MedicineBatch.deleteMany({}),
            db.Customer.deleteMany({}),
            db.Prescription.deleteMany({}),
            db.Order.deleteMany({}),
            db.Invoice.deleteMany({}),
            db.StockLog.deleteMany({}),
            db.Notification.deleteMany({}),
            db.OTP.deleteMany({}),
        ]);
        console.log('✅ Collections cleared.');

        // 1. Create Main Branch
        const branch = await db.Branch.create({
            name: 'MedCab Apex Super Pharmacy & Diagnostics',
            code: 'MED-APEX-01',
            drug_license_no: 'DL-UP-LKO-2026-98765',
            gstin: '09AAACM1234F1Z5',
            address: 'Shop No. 12-14, Ground Floor, Hazratganj, Lucknow, UP - 226001',
            contact_number: '+91 9876543210',
            email: 'apex.pharmacy@medcab.in',
            is_active: true,
        });
        console.log(`✅ Branch Created: ${branch.name} (ID: ${branch._id})`);

        const hashPassword = async (pwd) => {
            const salt = await bcrypt.genSalt(10);
            return bcrypt.hash(pwd, salt);
        };

        // 2. Create Users
        const ownerPassword = await hashPassword('Medcab@123');
        const pharmacistPassword = await hashPassword('Pharmacist@123');
        const packerPassword = await hashPassword('Packer@123');
        const cashierPassword = await hashPassword('Cashier@123');
        const blockedStaffPassword = await hashPassword('Staff@123');

        const owner = await db.User.create({
            branch_id: branch._id,
            full_name: 'Dr. Anurag Tiwari (Owner)',
            email: 'owner@medcab.com',
            phone: '9876500001',
            password_hash: ownerPassword,
            role: ROLES.PHARMACY_OWNER,
            pharmacist_reg_no: 'REG-UP-OWNER-001',
            features_granted: DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER],
            is_active: true,
            is_blocked: false,
        });

        // Link the store to its owner (same as registration does); without this the
        // store drops out of GET /branch/all-branches once the owner switches away.
        branch.owner_id = owner._id;
        await branch.save();

        const pharmacist = await db.User.create({
            branch_id: branch._id,
            full_name: 'Rahul Sharma (Senior Pharmacist)',
            email: 'pharmacist@medcab.com',
            phone: '9876500002',
            password_hash: pharmacistPassword,
            role: ROLES.PHARMACIST,
            pharmacist_reg_no: 'PH-UP-2024-5541',
            features_granted: DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACIST],
            is_active: true,
            is_blocked: false,
        });

        const packer = await db.User.create({
            branch_id: branch._id,
            full_name: 'Vikas Verma (Dispatch & Packing)',
            email: 'packer@medcab.com',
            phone: '9876500003',
            password_hash: packerPassword,
            role: ROLES.PICKER_PACKER,
            features_granted: DEFAULT_ROLE_PERMISSIONS[ROLES.PICKER_PACKER],
            is_active: true,
            is_blocked: false,
        });

        const cashier = await db.User.create({
            branch_id: branch._id,
            full_name: 'Pooja Singh (Billing & Counter)',
            email: 'cashier@medcab.com',
            phone: '9876500004',
            password_hash: cashierPassword,
            role: ROLES.CASHIER,
            features_granted: DEFAULT_ROLE_PERMISSIONS[ROLES.CASHIER],
            is_active: true,
            is_blocked: false,
        });

        const blockedUser = await db.User.create({
            branch_id: branch._id,
            full_name: 'Amit Kumar (Suspended Staff)',
            email: 'blocked@medcab.com',
            phone: '9876500005',
            password_hash: blockedStaffPassword,
            role: ROLES.CASHIER,
            features_granted: DEFAULT_ROLE_PERMISSIONS[ROLES.CASHIER],
            is_active: true,
            is_blocked: true,
            block_reason: 'Audit discrepancy under investigation',
        });

        console.log('✅ Staff & Owner Accounts Created');

        // 3. Categories
        const catAntibiotics = await db.Category.create({ branch_id: branch._id, name: 'Antibiotics', description: 'Broad spectrum antibacterial medicines' });
        const catPainRelief = await db.Category.create({ branch_id: branch._id, name: 'Pain Relief & Analgesics', description: 'Fever and pain management tablets' });
        const catCardiac = await db.Category.create({ branch_id: branch._id, name: 'Cardiac & Hypertension', description: 'Heart and Blood Pressure treatments' });
        const catDiabetes = await db.Category.create({ branch_id: branch._id, name: 'Diabetes Care', description: 'Glycemic control and insulin tablets' });
        const catRespiratory = await db.Category.create({ branch_id: branch._id, name: 'Respiratory & Cough', description: 'Syrups and inhalers for throat and lungs' });

        // 4. Medicines & Batches
        const med1 = await db.Medicine.create({
            branch_id: branch._id,
            category_id: catAntibiotics._id,
            name: 'Augmentin 625 Duo Tablet',
            generic_name: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)',
            sku_barcode: '8901117001234',
            manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
            hsn_code: '3004',
            form: 'Tablet',
            unit: 'Strip',
            unit_quantity: 10,
            is_prescription_required: true,
            low_stock_threshold: 15,
            mrp: 223.50,
            sale_price: 205.00,
            purchase_rate: 150.00,
            gst_rate: 12.00,
        });

        const batch1 = await db.MedicineBatch.create({
            branch_id: branch._id,
            medicine_id: med1._id,
            batch_number: 'AUG-2026-X1',
            mfg_date: new Date('2025-01-10'),
            expiry_date: new Date('2027-06-30'),
            purchase_rate: 150.00,
            mrp: 223.50,
            sale_price: 205.00,
            gst_rate: 12.00,
            current_stock: 120,
            rack_location: 'Rack A - Shelf 1',
        });

        const med2 = await db.Medicine.create({
            branch_id: branch._id,
            category_id: catPainRelief._id,
            name: 'Dolo 650 Tablet',
            generic_name: 'Paracetamol (650mg)',
            sku_barcode: '8901117005678',
            manufacturer: 'Micro Labs Ltd',
            hsn_code: '3004',
            form: 'Tablet',
            unit: 'Strip',
            unit_quantity: 15,
            is_prescription_required: false,
            low_stock_threshold: 20,
            mrp: 34.00,
            sale_price: 32.00,
            purchase_rate: 22.00,
            gst_rate: 12.00,
        });

        const batch2 = await db.MedicineBatch.create({
            branch_id: branch._id,
            medicine_id: med2._id,
            batch_number: 'DL-650-B9',
            mfg_date: new Date('2025-05-01'),
            expiry_date: new Date('2028-04-30'),
            purchase_rate: 22.00,
            mrp: 34.00,
            sale_price: 32.00,
            gst_rate: 12.00,
            current_stock: 350,
            rack_location: 'Rack A - Shelf 3',
        });

        const med3 = await db.Medicine.create({
            branch_id: branch._id,
            category_id: catCardiac._id,
            name: 'Telma 40 Tablet',
            generic_name: 'Telmisartan (40mg)',
            sku_barcode: '8901117009999',
            manufacturer: 'Glenmark Pharmaceuticals',
            hsn_code: '3004',
            form: 'Tablet',
            unit: 'Strip',
            unit_quantity: 15,
            is_prescription_required: true,
            low_stock_threshold: 25,
            mrp: 240.00,
            sale_price: 215.00,
            purchase_rate: 120.00,
            gst_rate: 12.00,
        });

        const batch3 = await db.MedicineBatch.create({
            branch_id: branch._id,
            medicine_id: med3._id,
            batch_number: 'TEL-40-A2',
            mfg_date: new Date('2024-11-01'),
            expiry_date: new Date('2026-10-31'),
            purchase_rate: 120.00,
            mrp: 240.00,
            sale_price: 215.00,
            gst_rate: 12.00,
            current_stock: 5,
            rack_location: 'Rack B - Shelf 2',
        });

        const med4 = await db.Medicine.create({
            branch_id: branch._id,
            category_id: catDiabetes._id,
            name: 'Glycomet GP 1 Tablet',
            generic_name: 'Glimepiride (1mg) + Metformin (500mg)',
            sku_barcode: '8901117008888',
            manufacturer: 'USV Ltd',
            hsn_code: '3004',
            form: 'Tablet',
            unit: 'Strip',
            unit_quantity: 15,
            is_prescription_required: true,
            low_stock_threshold: 10,
            mrp: 165.00,
            sale_price: 150.00,
            purchase_rate: 85.00,
            gst_rate: 12.00,
        });

        const batch4 = await db.MedicineBatch.create({
            branch_id: branch._id,
            medicine_id: med4._id,
            batch_number: 'GLY-GP-EXP',
            mfg_date: new Date('2024-04-01'),
            expiry_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            purchase_rate: 85.00,
            mrp: 165.00,
            sale_price: 150.00,
            gst_rate: 12.00,
            current_stock: 45,
            rack_location: 'Rack C - Shelf 1',
        });

        const med5 = await db.Medicine.create({
            branch_id: branch._id,
            category_id: catRespiratory._id,
            name: 'Ascoril LS Syrup',
            generic_name: 'Levosalbutamol + Ambroxol + Guaifenesin',
            sku_barcode: '8901117007777',
            manufacturer: 'Glenmark Pharmaceuticals',
            hsn_code: '3004',
            form: 'Syrup',
            unit: 'Bottle',
            unit_quantity: 1,
            is_prescription_required: false,
            low_stock_threshold: 10,
            mrp: 120.00,
            sale_price: 110.00,
            purchase_rate: 70.00,
            gst_rate: 12.00,
        });

        const batch5 = await db.MedicineBatch.create({
            branch_id: branch._id,
            medicine_id: med5._id,
            batch_number: 'ASC-LS-09',
            mfg_date: new Date('2025-02-01'),
            expiry_date: new Date('2027-01-31'),
            purchase_rate: 70.00,
            mrp: 120.00,
            sale_price: 110.00,
            gst_rate: 12.00,
            current_stock: 80,
            rack_location: 'Rack D - Shelf 4',
        });

        console.log('✅ Categories, Medicines and Batches Created');

        // 5. Customers
        const cust1 = await db.Customer.create({
            branch_id: branch._id,
            name: 'Rameshwar Prasad',
            phone: '9876123450',
            email: 'rameshwar.p@gmail.com',
            address: 'House 45, Aliganj, Lucknow',
            city: 'Lucknow',
            pincode: '226024',
            khata_balance: 450.00,
        });

        const cust2 = await db.Customer.create({
            branch_id: branch._id,
            name: 'Sunita Sharma',
            phone: '9876123451',
            email: 'sunita.sharma@yahoo.com',
            address: 'Flat 302, Gomti Nagar, Lucknow',
            city: 'Lucknow',
            pincode: '226010',
            khata_balance: 0.00,
        });

        console.log('✅ Customers Created');

        // 6. Demo Prescription
        const rx = await db.Prescription.create({
            branch_id: branch._id,
            customer_id: cust1._id,
            patient_name: 'Rameshwar Prasad',
            patient_age: 58,
            patient_gender: 'MALE',
            doctor_name: 'Dr. S. K. Awasthi (MD Medicine)',
            doctor_reg_no: 'MCI-1988-5421',
            diagnosis: 'Advised Augmentin 625 Duo twice daily after meals for 5 days.',
            file_url: '/uploads/prescriptions/sample-rx.png',
            status: PRESCRIPTION_STATUS.VERIFIED,
        });

        // 7. Demo POS Invoice
        const invNumber = `INV-MED-APEX-01-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-1001`;
        const invoice = await db.Invoice.create({
            branch_id: branch._id,
            customer_id: cust1._id,
            invoice_number: invNumber,
            invoice_date: new Date(),
            patient_name: cust1.name,
            doctor_name: 'Dr. S. K. Awasthi',
            subtotal: 410.00,
            discount_amount: 20.00,
            total_tax: 46.80,
            cgst_amount: 23.40,
            sgst_amount: 23.40,
            igst_amount: 0.00,
            grand_total: 436.80,
            amount_paid: 436.80,
            balance_due: 0.00,
            payment_mode: PAYMENT_MODES.UPI,
            payment_status: PAYMENT_STATUS.COMPLETED || PAYMENT_STATUS.PAID,
            created_by_user_id: cashier._id,
            notes: 'Counter POS sale via QR Code',
            items: [
                {
                    medicine_id: med1._id,
                    batch_id: batch1._id,
                    medicine_name: med1.name,
                    batch_number: batch1.batch_number,
                    expiry_date: batch1.expiry_date,
                    hsn_code: med1.hsn_code,
                    quantity: 2,
                    unit_price: 205.00,
                    mrp: batch1.mrp,
                    discount_amount: 20.00,
                    gst_rate: 12.00,
                    gst_amount: 46.80,
                    total_amount: 436.80,
                },
            ],
        });

        // 8. Demo Order for Picker-Packer Workflow
        const orderNumber = `ORD-MED-APEX-01-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-2001`;
        const order = await db.Order.create({
            branch_id: branch._id,
            customer_id: cust2._id,
            prescription_id: rx._id,
            order_number: orderNumber,
            order_type: ORDER_TYPE?.DELIVERY || 'DELIVERY',
            status: ORDER_STATUS.PACKING,
            delivery_address: cust2.address,
            delivery_phone: cust2.phone,
            delivery_pincode: cust2.pincode,
            subtotal: 237.00,
            discount_amount: 0.00,
            tax_amount: 28.44,
            net_amount: 265.44,
            payment_mode: PAYMENT_MODES.CASH,
            payment_status: PAYMENT_STATUS.PENDING,
            assigned_packer_id: packer._id,
            created_by_user_id: owner._id,
            remarks: 'Deliver before 6 PM',
            items: [
                {
                    medicine_id: med2._id,
                    batch_id: batch2._id,
                    quantity: 3,
                    unit_price: 32.00,
                    mrp: 34.00,
                    gst_rate: 12.00,
                    gst_amount: 11.52,
                    discount_amount: 0,
                    total_amount: 107.52,
                },
                {
                    medicine_id: med5._id,
                    batch_id: batch5._id,
                    quantity: 1,
                    unit_price: 110.00,
                    mrp: 120.00,
                    gst_rate: 12.00,
                    gst_amount: 13.20,
                    discount_amount: 0,
                    total_amount: 123.20,
                },
            ],
        });

        // 9. Initial Notifications
        await db.Notification.create({
            branch_id: branch._id,
            user_id: null,
            title: '⚠️ Low Stock Alert',
            message: 'Telma 40 Tablet has only 5 strips remaining in stock.',
            type: 'INVENTORY',
            data: { medicineId: med3._id, stock: 5, threshold: 25 },
            is_read: false,
        });

        await db.Notification.create({
            branch_id: branch._id,
            user_id: null,
            title: '📅 Expiry Alert',
            message: 'Glycomet GP 1 Tablet (Batch: GLY-GP-EXP) expires on 2026-09-25.',
            type: 'INVENTORY',
            data: { medicineId: med4._id, batchNumber: 'GLY-GP-EXP', expiryDate: '2026-09-25' },
            is_read: false,
        });

        console.log('\n============================================================');
        console.log('🎉 MONGODB SEEDING COMPLETED SUCCESSFULLY!');
        console.log('============================================================\n');
        console.log('🔑 DEMO CREDENTIALS FOR TESTING:\n');
        console.log('1. PHARMACY OWNER (Full Access):');
        console.log('   Email:    owner@medcab.com');
        console.log('   Password: Medcab@123\n');
        console.log('2. PHARMACIST (Inventory, POS, Prescriptions, Orders):');
        console.log('   Email:    pharmacist@medcab.com');
        console.log('   Password: Pharmacist@123\n');
        console.log('3. PICKER / PACKER (Orders packing, dispatch):');
        console.log('   Email:    packer@medcab.com');
        console.log('   Password: Packer@123\n');
        console.log('4. CASHIER (POS Billing, Customers):');
        console.log('   Email:    cashier@medcab.com');
        console.log('   Password: Cashier@123\n');
        console.log('5. BLOCKED STAFF (Will be rejected on login):');
        console.log('   Email:    blocked@medcab.com');
        console.log('   Password: Staff@123\n');
        console.log('============================================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding Failed:', error);
        process.exit(1);
    }
};

seedDatabase();
