// Shared fixtures for pharmacy unit tests (in-memory MongoDB from tests/setup.js).
const mongoose = require('mongoose');
const { Branch, Category, Medicine, MedicineBatch } = require('../../models/pharmacy');

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY);

let seq = 0;

/** A fresh store with one medicine + one batch (stock 79) and an owner user. */
const makeStore = async ({ stock = 79 } = {}) => {
    seq += 1;
    const ownerId = new mongoose.Types.ObjectId();
    const branch = await Branch.create({
        name: `Test Pharmacy ${seq}`,
        code: `TST-${Date.now().toString(36)}-${seq}`,
        drug_license_no: `DL-${seq}`,
        gstin: `27AAAAA${String(seq).padStart(4, '0')}A1Z5`,
        address: 'Test address',
        contact_number: '9876500000',
        owner_id: ownerId,
        subscription: Branch.trialSubscription(),
    });
    const category = await Category.create({ branch_id: branch._id, name: 'Respiratory' });
    const medicine = await Medicine.create({
        branch_id: branch._id,
        category_id: category._id,
        name: 'Ascoril LS Syrup',
        manufacturer: 'Glenmark',
        sku_barcode: `890111700${seq}`,
        hsn_code: '3004',
        mrp: 120,
        sale_price: 110,
        purchase_rate: 70,
        gst_rate: 12,
    });
    const batch = await MedicineBatch.create({
        branch_id: branch._id,
        medicine_id: medicine._id,
        batch_number: 'ASC-LS-09',
        expiry_date: inDays(300),
        purchase_rate: 70,
        mrp: 120,
        sale_price: 110,
        gst_rate: 12,
        current_stock: stock,
    });
    const user = {
        id: ownerId.toString(),
        userId: ownerId,
        branchId: branch._id.toString(),
        role: 'PHARMACY_OWNER',
        fullName: 'Test Owner',
        email: 'owner@test.local',
        phone: '9876500000',
    };
    return { branch, category, medicine, batch, user };
};

/** Expects `promise` to reject with an ApiError carrying `errorCode`. */
const expectApiError = async (promise, errorCode, statusCode) => {
    let err = null;
    try {
        await promise;
    } catch (e) {
        err = e;
    }
    expect(err).not.toBeNull();
    expect(err.errorCode).toBe(errorCode);
    if (statusCode) expect(err.statusCode).toBe(statusCode);
    return err;
};

module.exports = { DAY, inDays, makeStore, expectApiError };
