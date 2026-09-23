const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const branchService = require('../../services/pharmacy/branch.service');
const staffService = require('../../services/pharmacy/staff.service');


const createBranch = asyncHandler(async (req, res) => {
    const branch = await branchService.createBranch(req.user, req.body);
    res.status(201).json(new ApiResponse(201, branch, 'New pharmacy branch created successfully'));
});

const getMyBranches = asyncHandler(async (req, res) => {
    const branches = await branchService.getMyBranches(req.user);
    res.status(200).json(new ApiResponse(200, branches, 'Owned branches fetched successfully'));
});

const getMyBranch = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.user.branchId;
    const branch = await branchService.getBranchDetails(branchId, req.user);
    res.status(200).json(new ApiResponse(200, branch, 'Branch details fetched successfully'));
});

const getBranchStaff = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.params.branchId || req.user.branchId;
    const staff = await staffService.getBranchStaff(req.user, { ...req.query, branch_id: branchId });
    res.status(200).json(new ApiResponse(200, staff, 'Branch staff members fetched successfully'));
});

const updateMyBranch = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.user.branchId;
    const updated = await branchService.updateBranchDetails(branchId, req.body, req.user);
    res.status(200).json(new ApiResponse(200, updated, 'Branch details updated successfully'));
});

const toggleAvailability = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.user.branchId;
    const { is_available } = req.body;
    const result = await branchService.toggleBranchAvailability(branchId, is_available, req.user);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const switchBranch = asyncHandler(async (req, res) => {
    const { branch_id } = req.body;
    const result = await branchService.switchActiveBranch(req.user, branch_id);
    res.status(200).json(new ApiResponse(200, result, result.message));
});

const addBranchStaff = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.params.branchId;
    const result = await staffService.createStaff(req.user, { ...req.body, branch_id: branchId });
    res.status(201).json(new ApiResponse(201, result, 'Staff member added to branch successfully'));
});

const removeBranchStaff = asyncHandler(async (req, res) => {
    const branchId = req.params.id || req.params.branchId;
    const staffId = req.params.staffId;
    const result = await staffService.deleteStaff(req.user, staffId, branchId);
    res.status(200).json(new ApiResponse(200, result, result.message || 'Staff member removed from branch successfully'));
});

module.exports = {
    createBranch,
    getMyBranches,
    getMyBranch,
    getBranchStaff,
    addBranchStaff,
    removeBranchStaff,
    updateMyBranch,
    toggleAvailability,
    switchBranch,
};

