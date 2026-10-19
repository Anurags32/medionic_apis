const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const posService = require('../../services/pharmacy/pos.service');


const createInvoice = asyncHandler(async (req, res) => {
    const invoice = await posService.createInvoice(req.user.branchId, req.user.userId, req.body);
    res.status(201).json(new ApiResponse(201, invoice, 'Invoice generated successfully'));
});

const getInvoiceById = asyncHandler(async (req, res) => {
    const invoice = await posService.getInvoiceById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, invoice, 'Invoice details fetched successfully'));
});

const getInvoiceReceipt = asyncHandler(async (req, res) => {
    const receipt = await posService.getInvoiceReceipt(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, receipt, 'Printable bill receipt generated successfully'));
});

const getInvoices = asyncHandler(async (req, res) => {
    const result = await posService.getInvoices(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Invoices fetched successfully'));
});

const returnInvoice = asyncHandler(async (req, res) => {
    const { items } = req.body;
    const result = await posService.returnInvoiceItems(req.user.branchId, req.user.userId, req.params.id, items);
    res.status(200).json(new ApiResponse(200, result, 'Return and refund processed successfully'));
});

const getDailyRegister = asyncHandler(async (req, res) => {
    const result = await posService.getDailyRegisterSummary(req.user.branchId);
    res.status(200).json(new ApiResponse(200, result, 'Daily register summary fetched successfully'));
});

module.exports = {
    createInvoice,
    getInvoiceById,
    getInvoiceReceipt,
    getInvoices,
    returnInvoice,
    getDailyRegister,
};

