const express = require('express');
const router = express.Router();
const branchController = require('../../controllers/pharmacy/branch.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeOwnerOnly } = require('../../middleware/pharmacy/rbac.middleware');
const validate = require('../../middleware/pharmacy/validate.middleware');
const { createStaffRules } = require('../../validations/pharmacy/staff.validation');
const { createBranchRules, updateBranchRules } = require('../../validations/pharmacy/branch.validation');

router.use(authenticateToken);

router.post('/', authorizeOwnerOnly, validate(createBranchRules), branchController.createBranch);
router.get('/', authorizeOwnerOnly, branchController.getMyBranches);
router.get('/all-branches', authorizeOwnerOnly, branchController.getMyBranches);
router.get('/my-branch', branchController.getMyBranch);
router.get('/subscription', branchController.getSubscription);
router.get('/plan', branchController.getSubscription);
router.post('/subscription/renew', authorizeOwnerOnly, branchController.renewSubscription);
router.post('/plan/renew', authorizeOwnerOnly, branchController.renewSubscription);
// Plan catalog + Razorpay recharge (exempt from planGuard: URL contains /plan)
router.get('/plans', branchController.getPlans);
router.post('/plan/checkout', authorizeOwnerOnly, branchController.createPlanCheckout);
router.post('/plan/verify', authorizeOwnerOnly, branchController.verifyPlanPayment);
router.get('/plan/history', branchController.getPlanHistory);
router.get('/:id/subscription', branchController.getSubscription);
router.get('/:id/staff', branchController.getBranchStaff);
router.get('/stores/:id/staff', branchController.getBranchStaff);
router.post('/:id/staff', authorizeOwnerOnly, validate(createStaffRules), branchController.addBranchStaff);
router.delete('/:id/staff/:staffId', authorizeOwnerOnly, branchController.removeBranchStaff);
router.get('/:id', branchController.getMyBranch);
router.put('/my-branch', authorizeOwnerOnly, validate(updateBranchRules), branchController.updateMyBranch);
router.put('/:id', authorizeOwnerOnly, validate(updateBranchRules), branchController.updateMyBranch);
router.patch('/:id/toggle-availability', authorizeOwnerOnly, branchController.toggleAvailability);
router.post('/switch-branch', branchController.switchBranch);

module.exports = router;

