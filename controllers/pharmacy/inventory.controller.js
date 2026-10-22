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
    const payload = { ...req.body, userId: req.user?.userId || req.user?._id || req.user?.id };
    const medicine = await inventoryService.createMedicine(req.user.branchId, payload, req.file);
    res.status(201).json(new ApiResponse(201, medicine, 'Medicine created successfully'));
});

const importMedicines = asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    const summary = await inventoryService.importMedicines(req.user.branchId, userId, req.body.rows, {
        stop_on_error: req.body.stop_on_error === true,
    });
    res.status(200).json(new ApiResponse(200, summary, `Imported ${summary.created} medicines, ${summary.batches_added} batches added`));
});

const importTemplate = asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="medislip-inventory-template.csv"');
    res.status(200).send(inventoryService.importTemplateCsv());
});

const createMedicineWithBatch = asyncHandler(async (req, res) => {
    const result = await inventoryService.createMedicineWithBatch(req.user.branchId, req.user.userId, req.body, req.file);
    res.status(201).json(new ApiResponse(201, result, 'Medicine and batch created successfully'));
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

const getMedicineBatches = asyncHandler(async (req, res) => {
    const medicineId = req.params.medicineId || req.params.id;
    const batches = await inventoryService.getMedicineBatches(req.user.branchId, medicineId);
    res.status(200).json(new ApiResponse(200, batches, 'Medicine batches fetched successfully'));
});

const addBatchToMedicine = asyncHandler(async (req, res) => {
    const medicineId = req.params.medicineId || req.params.id;
    const batch = await inventoryService.createBatch(req.user.branchId, req.user.userId, {
        ...req.body,
        medicine_id: medicineId,
    });
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
    const counts = await inventoryService.getStockCounts(req.user.branchId);
    res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Low stock alerts fetched successfully',
        data: counts.lowStockMedicines,
        lowStockCount: counts.lowStockCount,
        outOfStockCount: counts.outOfStockCount,
        expiringSoonCount: counts.expiringSoonCount,
        expiredCount: counts.expiredCount,
        counts: {
            lowStockCount: counts.lowStockCount,
            outOfStockCount: counts.outOfStockCount,
            expiringSoonCount: counts.expiringSoonCount,
            expiredCount: counts.expiredCount,
            low_stock_count: counts.lowStockCount,
            out_of_stock_count: counts.outOfStockCount,
            expiring_soon_count: counts.expiringSoonCount,
            expired_count: counts.expiredCount,
        },
    });
});

const getExpiringBatches = asyncHandler(async (req, res) => {
    const counts = await inventoryService.getStockCounts(req.user.branchId, req.query.days || 60);
    res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Expiring batches fetched successfully',
        data: counts.expiringBatches,
        lowStockCount: counts.lowStockCount,
        outOfStockCount: counts.outOfStockCount,
        expiringSoonCount: counts.expiringSoonCount,
        expiredCount: counts.expiredCount,
        counts: {
            lowStockCount: counts.lowStockCount,
            outOfStockCount: counts.outOfStockCount,
            expiringSoonCount: counts.expiringSoonCount,
            expiredCount: counts.expiredCount,
            low_stock_count: counts.lowStockCount,
            out_of_stock_count: counts.outOfStockCount,
            expiring_soon_count: counts.expiringSoonCount,
            expired_count: counts.expiredCount,
        },
    });
});

const getExpiredBatches = asyncHandler(async (req, res) => {
    const counts = await inventoryService.getStockCounts(req.user.branchId);
    res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Expired batches fetched successfully',
        data: counts.expiredBatches,
        lowStockCount: counts.lowStockCount,
        outOfStockCount: counts.outOfStockCount,
        expiringSoonCount: counts.expiringSoonCount,
        expiredCount: counts.expiredCount,
        counts: {
            lowStockCount: counts.lowStockCount,
            outOfStockCount: counts.outOfStockCount,
            expiringSoonCount: counts.expiringSoonCount,
            expiredCount: counts.expiredCount,
        },
    });
});

const getInventorySummary = asyncHandler(async (req, res) => {
    const counts = await inventoryService.getStockCounts(req.user.branchId, req.query.days || 60);
    res.status(200).json(new ApiResponse(200, counts, 'Inventory summary fetched successfully'));
});

module.exports = {
    createCategory,
    getCategories,
    createMedicine,
    createMedicineWithBatch,
    importMedicines,
    importTemplate,
    updateMedicine,
    getMedicines,
    getMedicineById,
    createBatch,
    getMedicineBatches,
    addBatchToMedicine,
    adjustStock,
    processReturn,
    lookupBarcode,
    getLowStock,
    getExpiringBatches,
    getExpiredBatches,
    getInventorySummary,
};
