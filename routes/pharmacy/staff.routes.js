const express = require('express');
const router = express.Router();
const staffController = require('../../controllers/pharmacy/staff.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeOwnerOnly } = require('../../middleware/pharmacy/rbac.middleware');
const validate = require('../../middleware/pharmacy/validate.middleware');
const {
    createStaffRules,
    updateStaffRules,
    updatePermissionsRules,
    blockStaffRules,
    updateDutyRules,
    updateLocationRules,
    transferBranchRules,
} = require('../../validations/pharmacy/staff.validation');

router.use(authenticateToken);

// 1. Staff Duty & Real-time Location Updates (Accessible by authenticated staff)
router.post('/duty-status', validate(updateDutyRules), staffController.updateDutyStatus);
router.post('/location', validate(updateLocationRules), staffController.updateLocation);
router.post('/device-status', staffController.updateDeviceStatus);
router.patch('/device-status', staffController.updateDeviceStatus);

// 2. Owner-only Management & Monitoring Routes
router.get('/duty-overview', authorizeOwnerOnly, staffController.getDutyOverview);
router.get('/online-status', authorizeOwnerOnly, staffController.getOnlineStatus);
router.post('/', authorizeOwnerOnly, validate(createStaffRules), staffController.createStaff);
router.get('/', authorizeOwnerOnly, staffController.getStaff);
router.get('/branch/:id', authorizeOwnerOnly, staffController.getStaffByBranch);
router.get('/store/:id', authorizeOwnerOnly, staffController.getStaffByBranch);
router.get('/:id', authorizeOwnerOnly, staffController.getStaffById);
router.put('/:id', authorizeOwnerOnly, validate(updateStaffRules), staffController.updateStaff);
router.patch('/:id/branch', authorizeOwnerOnly, validate(transferBranchRules), staffController.transferBranch);
router.post('/:id/assign-branch', authorizeOwnerOnly, validate(transferBranchRules), staffController.transferBranch);
router.delete('/:id', authorizeOwnerOnly, staffController.deleteStaff);

router.post('/:id/force-logout', authorizeOwnerOnly, staffController.forceLogoutStaff);

router.patch('/:id/permissions', authorizeOwnerOnly, validate(updatePermissionsRules), staffController.updatePermissions);
router.post('/:id/grant-all', authorizeOwnerOnly, staffController.grantAllPermissions);
router.post('/:id/revoke-all', authorizeOwnerOnly, staffController.revokeAllPermissions);
router.post('/:id/reset-default', authorizeOwnerOnly, staffController.resetToDefault);

router.patch('/:id/block', authorizeOwnerOnly, validate(blockStaffRules), staffController.toggleBlockStaff);

module.exports = router;
