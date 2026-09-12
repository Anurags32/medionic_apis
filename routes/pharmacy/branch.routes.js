const express = require('express');
const router = express.Router();
const branchController = require('../../controllers/pharmacy/branch.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeOwnerOnly } = require('../../middleware/pharmacy/rbac.middleware');

router.use(authenticateToken);

router.post('/', authorizeOwnerOnly, branchController.createBranch);
router.get('/all-branches', authorizeOwnerOnly, branchController.getMyBranches);
router.get('/my-branch', branchController.getMyBranch);
router.get('/:id/staff', branchController.getBranchStaff);
router.get('/stores/:id/staff', branchController.getBranchStaff);
router.get('/:id', branchController.getMyBranch);
router.put('/my-branch', authorizeOwnerOnly, branchController.updateMyBranch);
router.put('/:id', authorizeOwnerOnly, branchController.updateMyBranch);
router.patch('/:id/toggle-availability', authorizeOwnerOnly, branchController.toggleAvailability);
router.post('/switch-branch', branchController.switchBranch);

module.exports = router;

