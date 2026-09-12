const { Branch, User } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { generateAccessToken, generateRefreshToken } = require('../../config/pharmacyJwt');
const { emitToBranch, emitToUser } = require('../../socket/pharmacyEvents');
const { ROLES, DEFAULT_ROLE_PERMISSIONS } = require('../../config/pharmacyConstants');


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
        contact_number: contact_number || ownerUser.phone || '',
        email: email || ownerUser.email || '',
        latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
        longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
        is_available: is_available !== undefined ? (is_available === true || is_available === 'true') : true,
        is_active: true,
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

    return branch;
};

const updateBranchDetails = async (branchId, payload, user = null) => {
    const branch = await Branch.findById(branchId);
    if (!branch) {
        throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    }

    if (user && user.role === ROLES.PHARMACY_OWNER && branch.owner_id && branch.owner_id.toString() !== user.id.toString() && branch._id.toString() !== user.branchId.toString()) {
        throw new ApiError(403, 'You do not have permission to edit this branch', 'BRANCH_ACCESS_DENIED');
    }

    const { name, drug_license_no, gstin, address, contact_number, email, latitude, longitude, is_available } = payload;

    if (name) branch.name = name;
    if (drug_license_no) branch.drug_license_no = drug_license_no;
    if (gstin) branch.gstin = gstin;
    if (address !== undefined) branch.address = address;
    if (contact_number !== undefined) branch.contact_number = contact_number;
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
    updateBranchDetails,
    toggleBranchAvailability,
    switchActiveBranch,
};
