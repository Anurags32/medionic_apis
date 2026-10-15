/**
 * scripts/auditStoreDataQuality.js
 * 
 * READ-ONLY audit script that checks existing store/branch records in MongoDB
 * against backend validation rules without modifying any data.
 * 
 * Usage: node scripts/auditStoreDataQuality.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { GSTIN_REGEX, DRUG_LICENSE_REGEX, PHONE_REGEX, PINCODE_REGEX } = require('../validations/pharmacy/branch.validation');

async function auditStores() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db';
    console.log('===============================================================');
    console.log('🔍 MediSlip Store Data Quality Audit (READ-ONLY)');
    console.log(`📡 Connecting to DB: ${mongoURI}`);
    console.log('===============================================================\n');

    try {
        await mongoose.connect(mongoURI);
        const Branch = mongoose.model(
            'BranchAudit',
            new mongoose.Schema({}, { strict: false }),
            'branches'
        );

        const branches = await Branch.find({}).lean();
        console.log(`📦 Found ${branches.length} store/branch record(s) to inspect.\n`);

        let validCount = 0;
        let invalidCount = 0;
        const failureReports = [];

        for (const store of branches) {
            const errors = [];
            const storeId = store._id ? store._id.toString() : 'UNKNOWN';
            const storeName = store.name || 'UNNAMED_STORE';

            // 1. Address Validation
            const address = (store.address || '').trim();
            if (!address) {
                errors.push({ field: 'address', value: address, issue: 'Address is empty/missing' });
            } else if (/^\d+$/.test(address)) {
                errors.push({ field: 'address', value: address, issue: 'Address is numeric-only ("' + address + '")' });
            } else if (address.length < 10) {
                errors.push({ field: 'address', value: address, issue: `Address is too short (${address.length} chars: "${address}"). Min 10 required.` });
            }

            // 2. Pincode Validation
            const pincode = (store.pincode || '').trim();
            if (!pincode) {
                errors.push({ field: 'pincode', value: pincode, issue: 'Pincode is missing' });
            } else if (!PINCODE_REGEX.test(pincode)) {
                errors.push({ field: 'pincode', value: pincode, issue: `Invalid pincode ("${pincode}"). Must be a 6-digit postal code.` });
            }

            // 3. Phone / Contact Number Validation
            const phone = (store.contact_number || store.phone || '').trim();
            if (!phone) {
                errors.push({ field: 'contact_number', value: phone, issue: 'Contact phone number is missing' });
            } else if (!PHONE_REGEX.test(phone)) {
                errors.push({ field: 'contact_number', value: phone, issue: `Invalid phone format ("${phone}"). Must be a valid 10-digit mobile number.` });
            }

            // 4. GSTIN Validation
            const gstin = (store.gstin || '').trim();
            if (!gstin) {
                errors.push({ field: 'gstin', value: gstin, issue: 'GSTIN is missing' });
            } else if (!GSTIN_REGEX.test(gstin.toUpperCase())) {
                errors.push({ field: 'gstin', value: gstin, issue: `Invalid GSTIN format ("${gstin}"). Must match regex ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$` });
            }

            // 5. Drug License Validation
            const drugLicense = (store.drug_license_no || store.drugLicenseNo || '').trim();
            if (!drugLicense) {
                errors.push({ field: 'drug_license_no', value: drugLicense, issue: 'Drug license number is missing' });
            } else if (!DRUG_LICENSE_REGEX.test(drugLicense)) {
                errors.push({ field: 'drug_license_no', value: drugLicense, issue: `Invalid drug license format ("${drugLicense}").` });
            }

            if (errors.length > 0) {
                invalidCount++;
                failureReports.push({
                    storeId,
                    storeName,
                    code: store.code || 'N/A',
                    errors,
                });
            } else {
                validCount++;
            }
        }

        console.log('---------------------------------------------------------------');
        console.log(`📊 AUDIT SUMMARY:`);
        console.log(`   ✅ Valid Stores  : ${validCount}`);
        console.log(`   ❌ Failing Stores: ${invalidCount}`);
        console.log('---------------------------------------------------------------\n');

        if (failureReports.length === 0) {
            console.log('🎉 All store records pass data quality validation!\n');
        } else {
            console.log('⚠️  THE FOLLOWING STORE RECORDS FAIL VALIDATION RULES:\n');
            failureReports.forEach((report, idx) => {
                console.log(`[Store #${idx + 1}] ID: ${report.storeId} | Name: "${report.storeName}" | Code: ${report.code}`);
                report.errors.forEach((err) => {
                    console.log(`   ❌ Field [${err.field}]: ${err.issue}`);
                });
                console.log('');
            });
            console.log('ℹ️  This script is READ-ONLY. No records have been modified in the database.');
        }
    } catch (err) {
        console.error('❌ Audit script encountered an error:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from DB.');
    }
}

if (require.main === module) {
    auditStores();
}

module.exports = { auditStores };
