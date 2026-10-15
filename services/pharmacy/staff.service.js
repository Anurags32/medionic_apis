const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Branch } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { ROLES, ALL_FEATURES, FEATURES, DEFAULT_ROLE_PERMISSIONS } = require('../../config/pharmacyConstants');
const { emitToUser, emitToBranch, getOnlineStatusMap } = require('../../socket/pharmacyEvents');


const filterStaffFeatures = (features = []) => {
    if (!Array.isArray(features)) return [];
    return features.filter(
        (f) => ALL_FEATURES.includes(f) && f !== FEATURES.STAFF_MANAGEMENT
    );
};

const resolveTargetBranch = async (caller, requestedBranchId) => {
    const callerBranchId = caller.branchId || caller;
    if (!requestedBranchId || requestedBranchId.toString() === callerBranchId.toString()) {
        return callerBranchId;
    }

    if (caller.role === ROLES.PHARMACY_OWNER) {
        const branch = await Branch.findOne({
            _id: requestedBranchId,
            $or: [{ owner_id: caller.id }, { _id: caller.branchId }],
            is_active: true,
        });
        if (!branch) {
            throw new ApiError(403, 'You do not have access to manage staff in this branch', 'BRANCH_ACCESS_DENIED');
        }
        return branch._id;
    }

    return callerBranchId;
};

const createStaff = async (caller, payload) => {
    const { branch_id, full_name, email, phone, password, role, pharmacist_reg_no, features_granted } = payload;

    if (role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(400, 'Cannot create another Pharmacy Owner via staff endpoint', 'INVALID_STAFF_ROLE');
    }

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
        throw new ApiError(400, 'Password is required and must be at least 6 characters long', 'PASSWORD_REQUIRED');
    }

    const defaultPasswords = ['password', 'password123', '123456', 'medcab123', 'admin123', 'staff123'];
    if (defaultPasswords.includes(password.trim().toLowerCase())) {
        throw new ApiError(400, 'Insecure or default passwords are not permitted. Please specify a strong, unique password.', 'INSECURE_PASSWORD');
    }

    const targetBranchId = await resolveTargetBranch(caller, branch_id);

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
        throw new ApiError(409, 'Email is already in use by another user', 'EMAIL_EXISTS');
    }

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
        throw new ApiError(409, 'Phone number is already in use by another user', 'PHONE_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const rawFeatures = features_granted && Array.isArray(features_granted) && features_granted.length > 0
        ? features_granted
        : DEFAULT_ROLE_PERMISSIONS[role] || [];
    
    const assignedFeatures = filterStaffFeatures(rawFeatures);

    const newStaff = await User.create({
        branch_id: targetBranchId,
        full_name,
        email: email.toLowerCase(),
        phone: phone.trim(),
        password_hash,
        role,
        pharmacist_reg_no: role === ROLES.PHARMACIST ? (pharmacist_reg_no || null) : null,
        features_granted: assignedFeatures,
        token_version: 0,
        duty_status: 'OFF_DUTY',
        is_online: false,
        must_change_password: true,
        battery_level: null,
        active_counter: null,
        is_active: true,
        is_blocked: false,
    });

    return {
        id: newStaff._id.toString(),
        branch_id: newStaff.branch_id.toString(),
        full_name: newStaff.full_name,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        pharmacist_reg_no: newStaff.pharmacist_reg_no,
        features_granted: newStaff.features_granted,
        duty_status: newStaff.duty_status,
        must_change_password: true,
        mustChangePassword: true,
        battery: null,
        battery_level: null,
        gps: null,
        active_on_counter: null,
        counter: null,
        is_active: newStaff.is_active,
        is_blocked: newStaff.is_blocked,
        created_at: newStaff.created_at,
    };
};

const getBranchStaff = async (caller, query = {}) => {
    let filter = {};
    const callerBranchId = caller.branchId || caller;
    const requestedBranchId = query.branch_id || query.store_id;

    if (caller.role === ROLES.PHARMACY_OWNER && (query.all_branches === 'true' || query.all_branches === true)) {
        const ownedBranches = await Branch.find({
            $or: [{ owner_id: caller.id }, { _id: caller.branchId }],
            is_active: true,
        }).select('_id');
        filter.branch_id = { $in: ownedBranches.map((b) => b._id) };
    } else if (requestedBranchId) {
        const targetBranchId = await resolveTargetBranch(caller, requestedBranchId);
        filter.branch_id = targetBranchId;
    } else {
        filter.branch_id = callerBranchId;
    }

    if (query.role) {
        filter.role = query.role;
    } else {
        filter.role = { $ne: ROLES.PHARMACY_OWNER };
    }
    if (query.duty_status) {
        filter.duty_status = query.duty_status;
    }
    if (query.is_blocked !== undefined) {
        filter.is_blocked = query.is_blocked === 'true' || query.is_blocked === true;
    }
    if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [{ full_name: searchRegex }, { phone: searchRegex }, { email: searchRegex }];
    }

    const staffList = await User.find(filter)
        .populate('branch', 'name code address phone is_available')
        .sort({ created_at: -1 });

    return staffList.map((s) => {
        const sJson = s.toJSON();
        const hasGps = Boolean(s.current_location && s.current_location.latitude && s.current_location.longitude);
        sJson.battery = s.battery_level !== undefined && s.battery_level !== null ? s.battery_level : null;
        sJson.battery_level = sJson.battery;
        sJson.gps = hasGps ? s.current_location : null;
        sJson.active_on_counter = s.active_counter || null;
        sJson.counter = s.active_counter || null;
        sJson.mustChangePassword = Boolean(s.must_change_password);
        sJson.must_change_password = Boolean(s.must_change_password);
        return sJson;
    });
};

const getStaffOnlineStatus = async (caller, query = {}) => {
    let filter = {};
    const callerBranchId = caller.branchId || caller;

    if (caller.role === ROLES.PHARMACY_OWNER && (query.all_branches === 'true' || query.all_branches === true)) {
        const ownedBranches = await Branch.find({
            $or: [{ owner_id: caller.id }, { _id: caller.branchId }],
            is_active: true,
        }).select('_id');
        filter.branch_id = { $in: ownedBranches.map((b) => b._id) };
    } else if (query.branch_id) {
        const targetBranchId = await resolveTargetBranch(caller, query.branch_id);
        filter.branch_id = targetBranchId;
    } else {
        filter.branch_id = callerBranchId;
    }

    const staffList = await User.find(filter)
        .select('full_name email phone role is_online last_seen_at duty_status current_location battery_level active_counter must_change_password last_duty_toggle_at is_blocked is_active branch_id')
        .populate('branch', 'name code is_available')
        .sort({ full_name: 1 });

    const liveSocketMap = getOnlineStatusMap(callerBranchId.toString());

    const staffWithPresence = staffList.map((s) => {
        const socketPresence = liveSocketMap[s._id.toString()];
        const isOnline = socketPresence ? socketPresence.isOnline : Boolean(s.is_online);
        const lastSeen = socketPresence?.lastSeen || s.last_seen_at;
        const hasGps = Boolean(s.current_location && s.current_location.latitude && s.current_location.longitude);

        return {
            id: s._id.toString(),
            branch_id: s.branch_id ? s.branch_id._id || s.branch_id : null,
            branch_name: s.branch ? s.branch.name : '',
            full_name: s.full_name,
            email: s.email,
            phone: s.phone,
            role: s.role,
            duty_status: s.duty_status || 'OFF_DUTY',
            current_location: hasGps ? s.current_location : null,
            battery: s.battery_level !== undefined && s.battery_level !== null ? s.battery_level : null,
            battery_level: s.battery_level !== undefined && s.battery_level !== null ? s.battery_level : null,
            active_on_counter: s.active_counter || null,
            counter: s.active_counter || null,
            gps: hasGps ? s.current_location : null,
            mustChangePassword: Boolean(s.must_change_password),
            last_duty_toggle_at: s.last_duty_toggle_at,
            is_online: isOnline,
            last_seen_at: lastSeen,
            is_blocked: s.is_blocked,
            is_active: s.is_active,
        };
    });

    return staffWithPresence;
};

const updateDutyStatus = async (userId, payload) => {
    const { duty_status, latitude, longitude, address } = payload;

    if (!duty_status || !['ON_DUTY', 'OFF_DUTY'].includes(duty_status)) {
        throw new ApiError(400, "Valid duty_status ('ON_DUTY' or 'OFF_DUTY') is required", 'INVALID_DUTY_STATUS');
    }

    const user = await User.findById(userId).populate('branch');
    if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    user.duty_status = duty_status;
    user.last_duty_toggle_at = new Date();

    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
        user.current_location = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            address: address || (user.current_location ? user.current_location.address : ''),
            updated_at: new Date(),
        };
    } else if (address) {
        if (!user.current_location) user.current_location = {};
        user.current_location.address = address;
        user.current_location.updated_at = new Date();
    }

    if (payload.battery_level !== undefined && payload.battery_level !== null) {
        user.battery_level = Math.max(0, Math.min(100, parseInt(payload.battery_level, 10)));
    }
    if (payload.active_counter !== undefined) {
        user.active_counter = payload.active_counter ? String(payload.active_counter).trim() : null;
    } else if (payload.counter !== undefined) {
        user.active_counter = payload.counter ? String(payload.counter).trim() : null;
    }

    await user.save();

    const dutyPayload = {
        userId: user._id.toString(),
        fullName: user.full_name,
        role: user.role,
        branchId: user.branch_id ? (user.branch_id._id || user.branch_id).toString() : null,
        branchName: user.branch ? user.branch.name : '',
        duty_status: user.duty_status,
        current_location: user.current_location,
        last_duty_toggle_at: user.last_duty_toggle_at,
        timestamp: new Date().toISOString(),
    };

    if (user.branch_id) {
        emitToBranch((user.branch_id._id || user.branch_id).toString(), 'staff:duty_changed', dutyPayload);
    }
    emitToUser(user._id.toString(), 'staff:duty_changed', dutyPayload);

    return {
        id: user._id.toString(),
        full_name: user.full_name,
        role: user.role,
        duty_status: user.duty_status,
        current_location: user.current_location,
        last_duty_toggle_at: user.last_duty_toggle_at,
        message: `Duty status updated to ${user.duty_status}`,
    };
};

const updateStaffLocation = async (userId, payload) => {
    const { latitude, longitude, address } = payload;

    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
        throw new ApiError(400, 'Valid latitude and longitude are required for location update', 'INVALID_LOCATION_COORDINATES');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    user.current_location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || (user.current_location ? user.current_location.address : ''),
        updated_at: new Date(),
    };

    await user.save();

    const locationBroadcast = {
        staffId: user._id.toString(),
        name: user.full_name,
        role: user.role,
        branchId: user.branch_id ? user.branch_id.toString() : null,
        latitude: user.current_location.latitude,
        longitude: user.current_location.longitude,
        address: user.current_location.address,
        updated_at: user.current_location.updated_at,
        timestamp: new Date().toISOString(),
    };

    if (user.branch_id) {
        emitToBranch(user.branch_id.toString(), 'staff:location_broadcast', locationBroadcast);
    }

    return {
        message: 'Location coordinates updated successfully',
        current_location: user.current_location,
    };
};

const updateStaffDeviceStatus = async (userId, payload) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    if (payload.battery_level !== undefined && payload.battery_level !== null) {
        user.battery_level = Math.max(0, Math.min(100, parseInt(payload.battery_level, 10)));
    }
    if (payload.active_counter !== undefined) {
        user.active_counter = payload.active_counter ? String(payload.active_counter).trim() : null;
    } else if (payload.counter !== undefined) {
        user.active_counter = payload.counter ? String(payload.counter).trim() : null;
    }
    if (payload.latitude !== undefined && payload.longitude !== undefined) {
        user.current_location = {
            latitude: parseFloat(payload.latitude),
            longitude: parseFloat(payload.longitude),
            address: payload.address || (user.current_location ? user.current_location.address : ''),
            updated_at: new Date(),
        };
    }
    user.last_seen_at = new Date();
    await user.save();

    return {
        success: true,
        battery_level: user.battery_level,
        active_counter: user.active_counter,
        current_location: user.current_location,
    };
};

const getStaffDutyOverview = async (callerUser, query = {}) => {
    const callerId = callerUser.id;
    const currentBranchId = callerUser.branchId;

    let branches = [];
    if (callerUser.role === ROLES.PHARMACY_OWNER) {
        branches = await Branch.find({
            $or: [{ owner_id: callerId }, { _id: currentBranchId }],
            is_active: true,
        }).sort({ created_at: -1 });
    } else {
        branches = await Branch.find({ _id: currentBranchId, is_active: true });
    }

    const branchIds = branches.map((b) => b._id);
    const staffMembers = await User.find({
        branch_id: { $in: branchIds },
        is_active: true,
    }).populate('branch', 'name code is_available address contact_number').sort({ full_name: 1 });

    const liveSocketMap = getOnlineStatusMap(currentBranchId.toString());

    let totalStaff = staffMembers.length;
    let onDutyCount = 0;
    let offDutyCount = 0;
    let onlineCount = 0;

    const formattedStaffList = staffMembers.map((s) => {
        const socketPresence = liveSocketMap[s._id.toString()];
        const isOnline = socketPresence ? socketPresence.isOnline : Boolean(s.is_online);
        const lastSeen = socketPresence?.lastSeen || s.last_seen_at;
        const isOnDuty = s.duty_status === 'ON_DUTY';

        if (isOnDuty) onDutyCount++;
        else offDutyCount++;
        if (isOnline) onlineCount++;

        const hasGps = Boolean(s.current_location && s.current_location.latitude && s.current_location.longitude);

        return {
            id: s._id.toString(),
            full_name: s.full_name,
            email: s.email,
            phone: s.phone,
            role: s.role,
            pharmacist_reg_no: s.pharmacist_reg_no,
            duty_status: s.duty_status || 'OFF_DUTY',
            current_location: hasGps ? s.current_location : null,
            battery: s.battery_level !== undefined && s.battery_level !== null ? s.battery_level : null,
            battery_level: s.battery_level !== undefined && s.battery_level !== null ? s.battery_level : null,
            gps: hasGps ? s.current_location : null,
            active_on_counter: s.active_counter || null,
            counter: s.active_counter || null,
            mustChangePassword: Boolean(s.must_change_password),
            last_duty_toggle_at: s.last_duty_toggle_at,
            is_online: isOnline,
            last_seen_at: lastSeen,
            branch_id: s.branch ? s.branch._id.toString() : s.branch_id.toString(),
            branch_name: s.branch ? s.branch.name : '',
            branch_code: s.branch ? s.branch.code : '',
            branch_available: s.branch ? s.branch.is_available : true,
        };
    });

    const staffByBranch = branches.map((branch) => {
        const branchStaff = formattedStaffList.filter((s) => s.branch_id === branch._id.toString());
        return {
            branch_id: branch._id.toString(),
            branch_name: branch.name,
            branch_code: branch.code,
            is_available: branch.is_available,
            address: branch.address,
            contact_number: branch.contact_number,
            latitude: branch.latitude,
            longitude: branch.longitude,
            total_staff: branchStaff.length,
            on_duty_count: branchStaff.filter((s) => s.duty_status === 'ON_DUTY').length,
            off_duty_count: branchStaff.filter((s) => s.duty_status === 'OFF_DUTY').length,
            online_count: branchStaff.filter((s) => s.is_online).length,
            staff: branchStaff,
        };
    });

    return {
        summary: {
            total_branches: branches.length,
            total_staff: totalStaff,
            on_duty_staff: onDutyCount,
            off_duty_staff: offDutyCount,
            online_staff: onlineCount,
        },
        staff_by_branch: staffByBranch,
        all_staff: formattedStaffList,
    };
};

const getStaffById = async (branchId, staffId) => {
    const staff = await User.findOne({
        _id: staffId,
        branch_id: branchId,
    });

    if (!staff) {
        throw new ApiError(404, 'Staff member not found in this branch', 'STAFF_NOT_FOUND');
    }

    return staff;
};

const updateStaff = async (branchId, staffId, payload) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    if (staff.role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(403, 'Owner accounts cannot be modified via staff routes', 'CANNOT_MODIFY_OWNER');
    }

    const { full_name, phone, role, pharmacist_reg_no, password } = payload;

    if (full_name) staff.full_name = full_name;
    if (phone) staff.phone = phone.trim();
    if (pharmacist_reg_no !== undefined) staff.pharmacist_reg_no = pharmacist_reg_no;

    if (role && role !== staff.role) {
        if (role === ROLES.PHARMACY_OWNER) {
            throw new ApiError(400, 'Cannot change staff role to Owner', 'INVALID_ROLE');
        }
        staff.role = role;
        staff.features_granted = filterStaffFeatures(DEFAULT_ROLE_PERMISSIONS[role] || []);
    }

    if (password) {
        const salt = await bcrypt.genSalt(10);
        staff.password_hash = await bcrypt.hash(password, salt);
        staff.token_version = (staff.token_version || 0) + 1;
    }

    await staff.save();

    emitToUser(staff._id.toString(), 'staff:updated', {
        message: 'Your profile has been updated by the owner',
        role: staff.role,
        features: staff.features_granted,
    });

    return getStaffById(branchId, staffId);
};

const updateStaffPermissions = async (branchId, staffId, features) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    if (staff.role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(400, 'Owner permissions cannot be altered', 'OWNER_PERMISSIONS_FIXED');
    }

    const validFeatures = filterStaffFeatures(features);

    staff.features_granted = validFeatures;
    await staff.save();

    const permissionPayload = {
        userId: staff._id.toString(),
        features: staff.features_granted,
        message: 'Your feature permissions have been updated by the owner.',
    };

    emitToUser(staff._id.toString(), 'staff:permission_updated', permissionPayload);
    emitToUser(staff._id.toString(), 'staff:permissions_updated', permissionPayload);

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        role: staff.role,
        features_granted: staff.features_granted,
    };
};

const grantAllPermissions = async (branchId, staffId) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    staff.features_granted = ALL_FEATURES.filter((f) => f !== FEATURES.STAFF_MANAGEMENT);
    await staff.save();

    const permissionPayload = {
        userId: staff._id.toString(),
        features: staff.features_granted,
        message: 'All feature permissions have been granted by the owner.',
    };

    emitToUser(staff._id.toString(), 'staff:permission_updated', permissionPayload);
    emitToUser(staff._id.toString(), 'staff:permissions_updated', permissionPayload);

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        role: staff.role,
        features_granted: staff.features_granted,
        message: 'Granted all permissions successfully',
    };
};

const revokeAllPermissions = async (branchId, staffId) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    staff.features_granted = [];
    await staff.save();

    const permissionPayload = {
        userId: staff._id.toString(),
        features: [],
        message: 'All feature permissions have been revoked by the owner.',
    };

    emitToUser(staff._id.toString(), 'staff:permission_updated', permissionPayload);
    emitToUser(staff._id.toString(), 'staff:permissions_updated', permissionPayload);

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        role: staff.role,
        features_granted: [],
        message: 'Revoked all permissions successfully',
    };
};

const resetToDefaultPermissions = async (branchId, staffId) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    staff.features_granted = filterStaffFeatures(DEFAULT_ROLE_PERMISSIONS[staff.role] || []);
    await staff.save();

    const permissionPayload = {
        userId: staff._id.toString(),
        features: staff.features_granted,
        message: `Permissions reset to default ${staff.role} template.`,
    };

    emitToUser(staff._id.toString(), 'staff:permission_updated', permissionPayload);
    emitToUser(staff._id.toString(), 'staff:permissions_updated', permissionPayload);

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        role: staff.role,
        features_granted: staff.features_granted,
        message: 'Permissions reset to role default successfully',
    };
};

const forceLogoutStaff = async (branchId, staffId) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    if (staff.role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(400, 'Cannot force logout an Owner account', 'CANNOT_LOGOUT_OWNER');
    }

    staff.token_version = (staff.token_version || 0) + 1;
    staff.is_online = false;
    await staff.save();

    emitToUser(staff._id.toString(), 'staff:force_logout', {
        userId: staff._id.toString(),
        message: 'Your active session was terminated by the pharmacy owner.',
    });

    emitToUser(staff._id.toString(), 'staff:blocked', {
        userId: staff._id.toString(),
        reason: 'Session terminated by owner',
    });

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        message: 'Staff member session was force-terminated successfully.',
    };
};

const toggleBlockStaff = async (branchId, staffId, isBlocked, blockReason = null) => {
    const staff = await User.findOne({ _id: staffId, branch_id: branchId });
    if (!staff) {
        throw new ApiError(404, 'Staff member not found', 'STAFF_NOT_FOUND');
    }

    if (staff.role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(400, 'Owner accounts cannot be blocked', 'CANNOT_BLOCK_OWNER');
    }

    staff.is_blocked = isBlocked;
    staff.block_reason = isBlocked ? (blockReason || 'Blocked by owner') : null;

    if (isBlocked) {
        staff.token_version = (staff.token_version || 0) + 1;
        staff.is_online = false;
    }

    await staff.save();

    emitToUser(staff._id.toString(), 'staff:blocked', {
        userId: staff._id.toString(),
        isBlocked: staff.is_blocked,
        reason: staff.block_reason,
    });

    emitToUser(staff._id.toString(), 'staff:status_changed', {
        userId: staff._id.toString(),
        isBlocked: staff.is_blocked,
        reason: staff.block_reason,
    });

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        is_blocked: staff.is_blocked,
        block_reason: staff.block_reason,
        message: isBlocked ? 'Staff member blocked successfully' : 'Staff member unblocked successfully',
    };
};

const transferStaffBranch = async (caller, staffId, targetBranchId) => {
    if (!targetBranchId) {
        throw new ApiError(400, 'Target branch_id is required', 'TARGET_BRANCH_REQUIRED');
    }

    const targetBranch = await Branch.findOne({
        _id: targetBranchId,
        $or: [{ owner_id: caller.id }, { _id: caller.branchId }],
        is_active: true,
    });

    if (!targetBranch) {
        throw new ApiError(404, 'Target branch not found or access denied', 'TARGET_BRANCH_NOT_FOUND');
    }

    const ownerBranches = await Branch.find({
        $or: [{ owner_id: caller.id }, { _id: caller.branchId }],
        is_active: true,
    }).select('_id');
    const branchIds = ownerBranches.map((b) => b._id);

    const staff = await User.findOne({
        _id: staffId,
        branch_id: { $in: branchIds },
        is_active: true,
    }).populate('branch', 'name code');

    if (!staff) {
        throw new ApiError(404, 'Staff member not found in any of your branches', 'STAFF_NOT_FOUND');
    }

    if (staff.role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(400, 'Cannot transfer a Pharmacy Owner account', 'CANNOT_TRANSFER_OWNER');
    }

    const previousBranchId = staff.branch_id ? (staff.branch_id._id || staff.branch_id).toString() : null;
    const previousBranchName = staff.branch ? staff.branch.name : 'Previous Branch';

    if (previousBranchId === targetBranch._id.toString()) {
        throw new ApiError(400, `Staff member is already assigned to branch '${targetBranch.name}'`, 'ALREADY_ASSIGNED_TO_BRANCH');
    }

    staff.branch_id = targetBranch._id;
    staff.token_version = (staff.token_version || 0) + 1;
    staff.duty_status = 'OFF_DUTY';
    staff.is_online = false;
    await staff.save();

    const transferPayload = {
        userId: staff._id.toString(),
        fullName: staff.full_name,
        role: staff.role,
        oldBranchId: previousBranchId,
        oldBranchName: previousBranchName,
        newBranchId: targetBranch._id.toString(),
        newBranchName: targetBranch.name,
        newBranchCode: targetBranch.code,
        message: `Staff member ${staff.full_name} has been transferred to branch '${targetBranch.name}'.`,
        timestamp: new Date().toISOString(),
    };

    if (previousBranchId) {
        emitToBranch(previousBranchId, 'staff:transferred', transferPayload);
    }
    emitToBranch(targetBranch._id.toString(), 'staff:transferred', transferPayload);
    emitToUser(staff._id.toString(), 'staff:transferred', transferPayload);

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        old_branch: {
            id: previousBranchId,
            name: previousBranchName,
        },
        new_branch: {
            id: targetBranch._id.toString(),
            name: targetBranch.name,
            code: targetBranch.code,
            address: targetBranch.address,
        },
        message: `Staff member transferred to branch '${targetBranch.name}' successfully`,
    };
};

const deleteStaff = async (callerOrBranchId, staffId, requestedBranchId = null) => {
    let staff;
    if (callerOrBranchId && typeof callerOrBranchId === 'object') {
        const caller = callerOrBranchId;
        const ownerBranches = await Branch.find({
            $or: [{ owner_id: caller.id }, { _id: caller.branchId }],
            is_active: true,
        }).select('_id');
        const branchIds = ownerBranches.map((b) => b._id);
        const filterBranch = requestedBranchId ? [requestedBranchId] : branchIds;

        staff = await User.findOne({
            _id: staffId,
            branch_id: { $in: filterBranch },
        });
    } else {
        staff = await User.findOne({ _id: staffId, branch_id: callerOrBranchId });
    }

    if (!staff) {
        throw new ApiError(404, 'Staff member not found in your branch', 'STAFF_NOT_FOUND');
    }

    if (staff.role === ROLES.PHARMACY_OWNER) {
        throw new ApiError(400, 'Owner cannot be deleted', 'CANNOT_DELETE_OWNER');
    }

    staff.is_active = false;
    staff.is_blocked = true;
    staff.token_version = (staff.token_version || 0) + 1;
    staff.is_online = false;
    staff.block_reason = 'Account deactivated / removed from branch';
    await staff.save();

    const branchIdStr = staff.branch_id ? staff.branch_id.toString() : null;

    emitToUser(staff._id.toString(), 'staff:blocked', {
        userId: staff._id.toString(),
        isBlocked: true,
        reason: 'Account removed from branch',
    });

    emitToUser(staff._id.toString(), 'staff:status_changed', {
        userId: staff._id.toString(),
        isBlocked: true,
        reason: 'Account removed from branch',
    });

    if (branchIdStr) {
        emitToBranch(branchIdStr, 'staff:removed', {
            userId: staff._id.toString(),
            branchId: branchIdStr,
            fullName: staff.full_name,
            message: `Staff ${staff.full_name} was removed from branch.`,
        });
    }

    return {
        id: staff._id.toString(),
        full_name: staff.full_name,
        branch_id: branchIdStr,
        message: 'Staff member removed from branch successfully',
    };
};

const getStaffCounts = async (branchId) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const staffFilter = {
        branch_id: branchObjectId,
        role: { $ne: ROLES.PHARMACY_OWNER },
    };

    const staffMembers = await User.find(staffFilter).select('duty_status is_active is_blocked');

    const totalStaff = staffMembers.length;
    let onDutyNow = 0;
    let blocked = 0;
    let inactive = 0;
    let offDuty = 0;

    for (const s of staffMembers) {
        if (s.is_blocked) {
            blocked++;
        }
        if (!s.is_active) {
            inactive++;
        }
        if (s.duty_status === 'ON_DUTY' && s.is_active && !s.is_blocked) {
            onDutyNow++;
        }
        if (s.duty_status === 'OFF_DUTY' && s.is_active && !s.is_blocked) {
            offDuty++;
        }
    }

    return {
        totalStaff,
        onDutyNow,
        blocked,
        inactive,
        offDuty,
        // Backward compatible aliases
        total_staff: totalStaff,
        on_duty_now: onDutyNow,
        blocked_staff: blocked,
        inactive_staff: inactive,
        active_staff: onDutyNow,
    };
};

module.exports = {
    createStaff,
    getBranchStaff,
    getStaffCounts,
    getStaffOnlineStatus,
    getStaffById,
    updateStaff,
    updateStaffPermissions,
    grantAllPermissions,
    revokeAllPermissions,
    resetToDefaultPermissions,
    forceLogoutStaff,
    toggleBlockStaff,
    transferStaffBranch,
    deleteStaff,
    updateDutyStatus,
    updateStaffLocation,
    updateStaffDeviceStatus,
    getStaffDutyOverview,
};
