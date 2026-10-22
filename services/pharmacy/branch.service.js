const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Branch, User, PlanPayment } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { generateAccessToken, generateRefreshToken } = require('../../config/pharmacyJwt');
const { emitToBranch, emitToUser } = require('../../socket/pharmacyEvents');
const { ROLES, DEFAULT_ROLE_PERMISSIONS } = require('../../config/pharmacyConstants');
const plansConfig = require('../../config/pharmacyPlans');


const createBranch = async (ownerUser, payload) => {
    const {
        name,
        code,
        drug_license_no,
        gstin,
        address,
        contact_number,
        email,
        latitude,
        longitude,
        is_available,
    } = payload;

    if (!name || !drug_license_no || !gstin) {
        throw new ApiError(400, 'Branch name, drug_license_no, and gstin are required', 'BRANCH_DETAILS_REQUIRED');
    }

    const branchCode = (code || 'MED-' + Math.floor(1000 + Math.random() * 9000)).toUpperCase();

    const existingCode = await Branch.findOne({ code: branchCode });
    if (existingCode) {
        throw new ApiError(409, `Branch code '${branchCode}' already exists. Please provide a unique code.`, 'BRANCH_CODE_EXISTS');
    }

    const newBranch = await Branch.create({
        owner_id: ownerUser.id,
        name,
        code: branchCode,
        drug_license_no,
        gstin,
        address: address || '',
        city: payload.city || '',
        pincode: payload.pincode || '',
        contact_number: contact_number || payload.phone || ownerUser.phone || '',
        email: email || ownerUser.email || '',
        latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
        longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
        is_available: is_available !== undefined ? (is_available === true || is_available === 'true') : true,
        is_active: true,
        // Plans are per branch: every new store starts on the free trial.
        subscription: Branch.trialSubscription(),
    });

    emitToUser(ownerUser.id, 'branch:created', {
        branch: newBranch,
        message: `New branch '${newBranch.name}' created successfully`,
    });

    return newBranch;
};

const getMyBranches = async (ownerUser) => {
    const ownerId = ownerUser.id;
    const currentBranchId = ownerUser.branchId;

    const branches = await Branch.find({
        $or: [{ owner_id: ownerId }, { _id: currentBranchId }],
        is_active: true,
    }).sort({ created_at: -1 });

    const branchIds = branches.map((b) => b._id);
    const staffMembers = await User.find({
        branch_id: { $in: branchIds },
        is_active: true,
    }).select('branch_id role is_online duty_status current_location');

    const result = branches.map((branch) => {
        const bJson = branch.toJSON();
        const branchStaff = staffMembers.filter((s) => s.branch_id.toString() === branch._id.toString());
        bJson.total_staff = branchStaff.length;
        bJson.on_duty_staff = branchStaff.filter((s) => s.duty_status === 'ON_DUTY').length;
        bJson.online_staff = branchStaff.filter((s) => s.is_online).length;
        bJson.is_current_active = branch._id.toString() === currentBranchId.toString();
        const sub = branch.getSubscriptionDetails();
        bJson.subscription = sub;
        bJson.plan = sub;
        return bJson;
    });

    return result;
};

const getBranchDetails = async (branchId, user = null) => {
    const branch = await Branch.findById(branchId).populate({
        path: 'staff',
        select: 'full_name email phone role is_active is_blocked is_online duty_status current_location last_seen_at last_duty_toggle_at',
    });

    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user && user.role !== ROLES.PHARMACY_OWNER && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to view other branches', 'CROSS_BRANCH_FORBIDDEN');
    }

    const bJson = branch.toJSON();
    const subscriptionInfo = branch.getSubscriptionDetails();
    bJson.subscription = subscriptionInfo;
    bJson.plan = subscriptionInfo;
    bJson.subscription_status = subscriptionInfo.status;
    bJson.days_left = subscriptionInfo.daysLeft;

    return bJson;
};

const getBranchSubscription = async (branchId, user = null) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user && user.role !== ROLES.PHARMACY_OWNER && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to view this branch subscription', 'BRANCH_ACCESS_DENIED');
    }

    return branch.getSubscriptionDetails();
};

const renewBranchSubscription = async (branchId, payload = {}, user = null) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user && user.role === ROLES.PHARMACY_OWNER && branch.owner_id && branch.owner_id.toString() !== user.id.toString() && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to renew subscription for this branch', 'BRANCH_ACCESS_DENIED');
    }

    const durationDays = parseInt(payload.days || payload.durationDays || 30);
    const planName = payload.plan || payload.plan_name || 'Standard';

    const now = new Date();
    let currentExpiry = branch.subscription?.expiry_date ? new Date(branch.subscription.expiry_date) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    branch.subscription = {
        plan_name: planName,
        status: 'ACTIVE',
        start_date: branch.subscription?.start_date || now,
        expiry_date: newExpiry,
        auto_renew: Boolean(payload.auto_renew),
    };

    await branch.save();
    return branch.getSubscriptionDetails();
};

// ─── Plans: catalog, Razorpay checkout, verification, history ────────────────

const getPlanCatalog = () => plansConfig.planCatalog();

const assertOwnsBranch = (branch, user) => {
    if (!user || user.role !== ROLES.PHARMACY_OWNER) {
        throw new ApiError(403, 'Only the pharmacy owner can recharge a plan', 'OWNER_ONLY');
    }
    const owned = !branch.owner_id
        || branch.owner_id.toString() === user.id.toString()
        || branch._id.toString() === user.branchId.toString();
    if (!owned) {
        throw new ApiError(403, 'You do not have permission to recharge this branch', 'BRANCH_ACCESS_DENIED');
    }
};

const getRazorpayClient = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret || keyId.startsWith('rzp_test_your')) {
        throw new ApiError(503, 'Online payment is not configured on the server', 'PAYMENT_NOT_CONFIGURED');
    }
    return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
};

/**
 * Creates a Razorpay order for a plan. The amount comes from the catalog
 * (never from the client) and the attempt is stored as CREATED.
 */
const createPlanCheckout = async (branchId, payload, user) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }
    assertOwnsBranch(branch, user);

    const plan = plansConfig.getPlan(payload.plan_id || payload.plan);
    if (!plan || !plan.purchasable) {
        throw new ApiError(400, 'Choose a valid paid plan (basic, standard or pro)', 'INVALID_PLAN');
    }
    const cycle = plansConfig.getCycle(payload.billing_cycle || payload.cycle || 'monthly');
    if (!cycle) {
        throw new ApiError(400, 'billing_cycle must be monthly or yearly', 'INVALID_BILLING_CYCLE');
    }

    const amount = plansConfig.planAmount(plan, cycle);
    const { client, keyId } = getRazorpayClient();
    const receipt = `plan_${branch.code || branch._id}_${Date.now()}`.slice(0, 40);
    const order = await client.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt,
        notes: { branch_id: branch._id.toString(), plan_id: plan.id, billing_cycle: cycle.id },
    });

    const payment = await PlanPayment.create({
        branch_id: branch._id,
        created_by: user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: cycle.id,
        amount,
        currency: 'INR',
        status: 'CREATED',
        razorpay_order_id: order.id,
    });

    return {
        payment_id: payment._id.toString(),
        key_id: keyId,
        order_id: order.id,
        amount: order.amount, // paise
        currency: order.currency,
        plan: { id: plan.id, name: plan.name },
        billing_cycle: cycle.id,
        days: cycle.days,
        description: `MediSlip ${plan.name} · ${cycle.label} · ${branch.name}`,
        prefill: { name: user.fullName || '', email: user.email || '', contact: user.phone || '' },
    };
};

/**
 * Verifies the Razorpay signature and, only then, extends the branch plan.
 * Renewal starts from the current expiry when it is still in the future.
 */
const verifyPlanPayment = async (branchId, payload, user) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required', 'PAYMENT_FIELDS_REQUIRED');
    }

    const payment = await PlanPayment.findOne({ razorpay_order_id, branch_id: branchId });
    if (!payment) {
        throw new ApiError(404, 'Payment attempt not found for this branch', 'PAYMENT_NOT_FOUND');
    }
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }
    assertOwnsBranch(branch, user);

    if (payment.status === 'PAID') {
        return { subscription: branch.getSubscriptionDetails(), payment, already_processed: true };
    }

    const { keySecret } = getRazorpayClient();
    const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
    if (expected !== razorpay_signature) {
        payment.status = 'FAILED';
        payment.failure_reason = 'Invalid signature';
        await payment.save();
        throw new ApiError(400, 'Payment verification failed: invalid signature', 'PAYMENT_SIGNATURE_INVALID');
    }

    const plan = plansConfig.getPlan(payment.plan_id);
    const cycle = plansConfig.getCycle(payment.billing_cycle);
    const now = new Date();
    const currentExpiry = branch.subscription?.expiry_date ? new Date(branch.subscription.expiry_date) : now;
    // Trial days left are not carried over; paid time stacks on paid time.
    const base = branch.subscription?.plan_id !== 'trial' && currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(base.getTime() + cycle.days * 24 * 60 * 60 * 1000);

    branch.subscription = {
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: cycle.id,
        status: 'ACTIVE',
        start_date: branch.subscription?.plan_id === plan.id && branch.subscription?.start_date ? branch.subscription.start_date : now,
        expiry_date: newExpiry,
        auto_renew: false,
    };
    await branch.save();

    payment.status = 'PAID';
    payment.razorpay_payment_id = razorpay_payment_id;
    payment.period_start = base;
    payment.period_end = newExpiry;
    payment.paid_at = now;
    await payment.save();

    const subscription = branch.getSubscriptionDetails();
    emitToBranch(branch._id.toString(), 'branch:plan_updated', { branchId: branch._id.toString(), subscription });
    return { subscription, payment };
};

const getPlanHistory = async (branchId, user) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }
    if (user && user.role !== ROLES.PHARMACY_OWNER && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to view this branch plan history', 'BRANCH_ACCESS_DENIED');
    }
    return PlanPayment.find({ branch_id: branchId }).sort({ created_at: -1 }).limit(50);
};

const updateBranchDetails = async (branchId, payload, user = null) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user && user.role === ROLES.PHARMACY_OWNER && branch.owner_id && branch.owner_id.toString() !== user.id.toString() && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to edit this branch', 'BRANCH_ACCESS_DENIED');
    }

    const { name, drug_license_no, gstin, address, city, pincode, contact_number, phone, email, latitude, longitude, is_available } = payload;

    if (name) branch.name = name;
    if (drug_license_no) branch.drug_license_no = drug_license_no;
    if (gstin) branch.gstin = gstin;
    if (address !== undefined) branch.address = address;
    if (city !== undefined) branch.city = city;
    if (pincode !== undefined) branch.pincode = pincode;
    if (contact_number !== undefined) branch.contact_number = contact_number;
    if (phone !== undefined && contact_number === undefined) branch.contact_number = phone;
    if (email !== undefined) branch.email = email;
    if (latitude !== undefined) branch.latitude = parseFloat(latitude);
    if (longitude !== undefined) branch.longitude = parseFloat(longitude);
    if (is_available !== undefined) {
        branch.is_available = is_available === true || is_available === 'true';
        emitToBranch(branch._id.toString(), 'branch:availability_updated', {
            branchId: branch._id.toString(),
            branchName: branch.name,
            is_available: branch.is_available,
            timestamp: new Date().toISOString(),
        });
    }

    await branch.save();
    return branch;
};

const toggleBranchAvailability = async (branchId, isAvailable, user) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user && user.role === ROLES.PHARMACY_OWNER && branch.owner_id && branch.owner_id.toString() !== user.id.toString() && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to manage this branch availability', 'BRANCH_ACCESS_DENIED');
    }

    branch.is_available = isAvailable === true || isAvailable === 'true';
    await branch.save();

    const eventPayload = {
        branchId: branch._id.toString(),
        branchName: branch.name,
        branchCode: branch.code,
        is_available: branch.is_available,
        status_text: branch.is_available ? 'OPEN / AVAILABLE' : 'CLOSED / UNAVAILABLE',
        toggled_by: user ? user.fullName || user.id : 'Owner',
        timestamp: new Date().toISOString(),
    };

    emitToBranch(branch._id.toString(), 'branch:availability_updated', eventPayload);
    emitToBranch(branch._id.toString(), 'branch:status_updated', eventPayload);
    if (user) {
        emitToUser(user.id, 'branch:availability_updated', eventPayload);
    }

    return {
        branchId: branch._id.toString(),
        name: branch.name,
        code: branch.code,
        is_available: branch.is_available,
        message: `Branch status is now ${branch.is_available ? 'AVAILABLE (OPEN)' : 'UNAVAILABLE (CLOSED)'}`,
    };
};

const switchActiveBranch = async (user, targetBranchId) => {
    const branch = await Branch.findById(targetBranchId);
    if (!branch) {
        throw new ApiError(404, 'Target branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user.role === ROLES.PHARMACY_OWNER) {
        const isOwned = !branch.owner_id || branch.owner_id.toString() === user.id.toString() || branch._id.toString() === user.branchId.toString();
        if (!isOwned) {
            throw new ApiError(403, 'You do not have ownership of this branch', 'BRANCH_OWNERSHIP_REQUIRED');
        }
    } else {
        if (branch._id.toString() !== user.branchId.toString()) {
            throw new ApiError(403, 'Staff members cannot switch outside their assigned branch', 'BRANCH_SWITCH_FORBIDDEN');
        }
    }

    const livePermissions = user.role === ROLES.PHARMACY_OWNER
        ? DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER]
        : (user.features_granted || DEFAULT_ROLE_PERMISSIONS[user.role] || []);

    const tokenPayload = {
        userId: user.id,
        branchId: branch._id.toString(),
        role: user.role,
        features: livePermissions,
        tokenVersion: user.tokenVersion || 0,
    };

    const accessToken = generateAccessToken(tokenPayload);

    await User.updateOne({ _id: user.id }, { branch_id: branch._id });

    return {
        accessToken,
        active_branch: {
            id: branch._id.toString(),
            name: branch.name,
            code: branch.code,
            is_available: branch.is_available,
            address: branch.address,
        },
        message: `Switched active branch to '${branch.name}' successfully`,
    };
};

module.exports = {
    createBranch,
    getMyBranches,
    getBranchDetails,
    getBranchSubscription,
    renewBranchSubscription,
    getPlanCatalog,
    createPlanCheckout,
    verifyPlanPayment,
    getPlanHistory,
    updateBranchDetails,
    toggleBranchAvailability,
    switchActiveBranch,
};
