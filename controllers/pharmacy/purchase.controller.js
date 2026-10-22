const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const purchaseService = require('../../services/pharmacy/purchase.service');

// ─── Suppliers ───────────────────────────────────────────────────────────────

const createSupplier = asyncHandler(async (req, res) => {
    const supplier = await purchaseService.createSupplier(req.user.branchId, req.body);
    res.status(201).json(new ApiResponse(201, supplier, 'Supplier created successfully'));
});

const getSuppliers = asyncHandler(async (req, res) => {
    const suppliers = await purchaseService.getSuppliers(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, suppliers, 'Suppliers fetched successfully'));
});

const getSupplierById = asyncHandler(async (req, res) => {
    const supplier = await purchaseService.getSupplierById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, supplier, 'Supplier fetched successfully'));
});

const updateSupplier = asyncHandler(async (req, res) => {
    const supplier = await purchaseService.updateSupplier(req.user.branchId, req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, supplier, 'Supplier updated successfully'));
});

// ─── Purchases ───────────────────────────────────────────────────────────────

const createPurchase = asyncHandler(async (req, res) => {
    const purchase = await purchaseService.createPurchase(req.user.branchId, req.user, req.body);
    res.status(201).json(new ApiResponse(201, purchase, `Purchase ${purchase.purchase_number} recorded, stock updated`));
});

const getPurchases = asyncHandler(async (req, res) => {
    const result = await purchaseService.getPurchases(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Purchases fetched successfully'));
});

const getPurchaseSummary = asyncHandler(async (req, res) => {
    const summary = await purchaseService.getPurchaseSummary(req.user.branchId);
    res.status(200).json(new ApiResponse(200, summary, 'Purchase summary fetched successfully'));
});

const getPurchaseById = asyncHandler(async (req, res) => {
    const purchase = await purchaseService.getPurchaseById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, purchase, 'Purchase fetched successfully'));
});

const addPurchasePayment = asyncHandler(async (req, res) => {
    const purchase = await purchaseService.addPurchasePayment(req.user.branchId, req.params.id, req.user, req.body);
    res.status(200).json(new ApiResponse(200, purchase, 'Payment recorded successfully'));
});

const cancelPurchase = asyncHandler(async (req, res) => {
    const purchase = await purchaseService.cancelPurchase(req.user.branchId, req.params.id, req.user, req.body);
    res.status(200).json(new ApiResponse(200, purchase, `${purchase.purchase_number} cancelled, stock reversed`));
});

module.exports = {
    cancelPurchase,
    createSupplier,
    getSuppliers,
    getSupplierById,
    updateSupplier,
    createPurchase,
    getPurchases,
    getPurchaseSummary,
    getPurchaseById,
    addPurchasePayment,
};
