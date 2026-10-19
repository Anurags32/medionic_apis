const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const customerService = require('../../services/pharmacy/customer.service');


const createCustomer = asyncHandler(async (req, res) => {
    const customer = await customerService.createCustomer(req.user.branchId, req.body);
    res.status(201).json(new ApiResponse(201, customer, 'Customer created successfully'));
});

const getCustomers = asyncHandler(async (req, res) => {
    const result = await customerService.getCustomers(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Customers fetched successfully'));
});

const getCustomerById = asyncHandler(async (req, res) => {
    const customer = await customerService.getCustomerById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, customer, 'Customer profile fetched successfully'));
});

const settleKhata = asyncHandler(async (req, res) => {
    const { amount, payment_mode, paymentMode, notes } = req.body;
    const mode = payment_mode || paymentMode || 'CASH';
    const result = await customerService.settleKhataPayment(
        req.user.branchId,
        req.params.id,
        amount,
        mode,
        notes
    );
    res.status(200).json(new ApiResponse(200, result, 'Khata payment recorded successfully'));
});

const getCustomerLedger = asyncHandler(async (req, res) => {
    const result = await customerService.getCustomerLedger(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, result, 'Customer Khata ledger fetched successfully'));
});

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    settleKhata,
    getCustomerLedger,
};
