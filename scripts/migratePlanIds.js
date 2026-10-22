/**
 * One-off: branches created before plan ids existed have no
 * `subscription.plan_id`, so they would read as "Free Trial". Tag them as
 * paid Standard (monthly) and keep their current expiry.
 *
 *   node scripts/migratePlanIds.js            # dry run
 *   node scripts/migratePlanIds.js --apply    # write changes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Branch } = require('../models/pharmacy');

const apply = process.argv.includes('--apply');

(async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db';
    await mongoose.connect(uri);

    const filter = {
        $or: [{ 'subscription.plan_id': { $exists: false } }, { 'subscription.plan_id': null }],
    };
    const branches = await Branch.find(filter).select('name code subscription');
    console.log(`${branches.length} branch(es) without plan_id`);
    for (const b of branches) {
        console.log(` - ${b.code} ${b.name}: ${b.subscription?.plan_name || '-'} till ${b.subscription?.expiry_date?.toISOString?.().slice(0, 10) || '-'}`);
    }

    if (apply && branches.length) {
        const res = await Branch.updateMany(filter, {
            $set: {
                'subscription.plan_id': 'standard',
                'subscription.plan_name': 'Standard',
                'subscription.billing_cycle': 'monthly',
            },
        });
        console.log(`Updated ${res.modifiedCount} branch(es)`);
    } else if (!apply) {
        console.log('Dry run — re-run with --apply to write.');
    }

    await mongoose.disconnect();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
