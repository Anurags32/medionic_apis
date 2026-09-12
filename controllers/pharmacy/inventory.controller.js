const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const inventoryService = require('../../services/pharmacy/inventory.service');


const createCategory = asyncHandler(async (req, res) => {
    const category = await inventoryService.createCategory(req.user.branchId, req.body);
    res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
});

const getCategories = asyncHandler(async (req, res) => {
    const categories = await inventoryService.getCategories(req.user.branchId);
    res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully'));
});

const createMedicine = asyncHandler(async (req, res) => {
    const medicine = await inventoryService.createMedicine(req.user.branchId, req.body, req.file);
    res.status(201).json(new ApiResponse(201, medicine, 'Medicine created successfully'));
});

const updateMedicine = asyncHandler(async (req, res) => {
    const medicine = await inventoryService.updateMedicine(req.user.branchId, req.params.id, req.body, req.file);
    res.status(200).json(new ApiResponse(200, medicine, 'Medicine updated successfully'));
});

const getMedicines = asyncHandler(async (req, res) => {
    const result = await inventoryService.getMedicines(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Medicines fetched successfully'));
});

const getMedicineById = asyncHandler(async (req, res) => {
    const medicine = await inventoryService.getMedicineById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, medicine, 'Medicine details fetched successfully'));
});

const createBatch = asyncHandler(async (req, res) => {
    const batch = await inventoryService.createBatch(req.user.branchId, req.user.userId, req.body);
    res.status(201).json(new ApiResponse(201, batch, 'Medicine batch added successfully'));
});

const adjustStock = asyncHandler(async (req, res) => {
    const result = await inventoryService.adjustStock(req.user.branchId, req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, result, 'Stock adjusted successfully'));
});

const processReturn = asyncHandler(async (req, res) => {
    const result = await inventoryService.processReturn(req.user.branchId, req.user.userId, req.body);
    res.status(200).json(new ApiResponse(200, result, 'Return processed successfully'));
});

const lookupBarcode = asyncHandler(async (req, res) => {
    const medicine = await inventoryService.lookupByBarcode(req.user.branchId, req.params.barcode);
    res.status(200).json(new ApiResponse(200, medicine, 'Medicine found for barcode'));
});

const getLowStock = asyncHandler(async (req, res) => {
    const list = await inventoryService.getLowStockMedicines(req.user.branchId);
    res.status(200).json(new ApiResponse(200, list, 'Low stock alerts fetched successfully'));
});

const getExpiringBatches = asyncHandler(async (req, res) => {
    const list = await inventoryService.getExpiringBatches(req.user.branchId, req.query.days || 60);
    res.status(200).json(new ApiResponse(200, list, 'Expiring batches fetched successfully'));
});

module.exports = {
    createCategory,
    getCategories,
    createMedicine,
    updateMedicine,
    getMedicines,
    getMedicineById,
    createBatch,
    adjustStock,
    processReturn,
    lookupBarcode,
    getLowStock,
    getExpiringBatches,
};
