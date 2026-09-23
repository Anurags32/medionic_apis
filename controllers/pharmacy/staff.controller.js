const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const staffService = require('../../services/pharmacy/staff.service');


const createStaff = asyncHandler(async (req, res) => {
    const result = await staffService.createStaff(req.user, req.body);
    res.status(201).json(new ApiResponse(201, result, 'Staff member created successfully'));
});

const getStaff = asyncHandler(async (req, res) => {
    const result = await staffService.getBranchStaff(req.user, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Staff list fetched successfully'));
});

const getStaffByBranch = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.params.branchId;
    const result = await staffService.getBranchStaff(req.user, { ...req.query, branch_id: branchId });
    res.status(200).json(new ApiResponse(200, result, 'Branch staff fetched successfully'));
});

const getOnlineStatus = asyncHandler(async (req, res) => {
    const result = await staffService.getStaffOnlineStatus(req.user, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Staff online presence status fetched successfully'));
});

const updateDutyStatus = asyncHandler(async (req, res) => {
    const result = await staffService.updateDutyStatus(req.user.id, req.body);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const updateLocation = asyncHandler(async (req, res) => {
    const result = await staffService.updateStaffLocation(req.user.id, req.body);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const getDutyOverview = asyncHandler(async (req, res) => {
    const result = await staffService.getStaffDutyOverview(req.user, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Staff duty and GPS location overview fetched successfully'));
});

const getStaffById = asyncHandler(async (req, res) => {
    const result = await staffService.getStaffById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'Staff details fetched successfully'));
});

const updateStaff = asyncHandler(async (req, res) => {
    const result = await staffService.updateStaff(req.user.branchId, req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, result, 'Staff updated successfully'));
});

const updatePermissions = asyncHandler(async (req, res) => {
    const { features } = req.body;
    const result = await staffService.updateStaffPermissions(req.user.branchId, req.params.id, features);
    res.status(200).json(new ApiResponse(200, result, 'Staff permissions updated successfully'));
});

const grantAllPermissions = asyncHandler(async (req, res) => {
    const result = await staffService.grantAllPermissions(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'All permissions granted successfully'));
});

const revokeAllPermissions = asyncHandler(async (req, res) => {
    const result = await staffService.revokeAllPermissions(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'All permissions revoked successfully'));
});

const resetToDefault = asyncHandler(async (req, res) => {
    const result = await staffService.resetToDefaultPermissions(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'Permissions reset to role defaults successfully'));
});

const forceLogoutStaff = asyncHandler(async (req, res) => {
    const result = await staffService.forceLogoutStaff(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const toggleBlockStaff = asyncHandler(async (req, res) => {
    const { is_blocked, block_reason } = req.body;
    const result = await staffService.toggleBlockStaff(req.user.branchId, req.params.id, is_blocked, block_reason);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const transferBranch = asyncHandler(async (req, res) => {
    const result = await staffService.transferStaffBranch(req.user, req.params.id, req.body.branch_id);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const deleteStaff = asyncHandler(async (req, res) => {
    const result = await staffService.deleteStaff(req.user, req.params.id, req.params.branchId || req.query.branch_id);
    res.status(200).json(new ApiResponse(200, result, result.message || 'Staff member removed successfully'));
});

module.exports = {
    createStaff,
    getStaff,
    getStaffByBranch,
    getOnlineStatus,
    updateDutyStatus,
    updateLocation,
    getDutyOverview,
    getStaffById,
    updateStaff,
    updatePermissions,
    grantAllPermissions,
    revokeAllPermissions,
    resetToDefault,
    forceLogoutStaff,
    toggleBlockStaff,
    transferBranch,
    deleteStaff,
};
