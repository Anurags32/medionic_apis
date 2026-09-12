const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const reportService = require('../../services/pharmacy/report.service');


const getDashboardStats = asyncHandler(async (req, res) => {
    const stats = await reportService.getDashboardStats(req.user.branchId);
    res.status(200).json(new ApiResponse(200, stats, 'Dashboard statistics fetched successfully'));
});

const getSalesReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const report = await reportService.getSalesReport(req.user.branchId, startDate, endDate);
    res.status(200).json(new ApiResponse(200, report, 'Sales report fetched successfully'));
});

const getTopSellingMedicines = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const topMedicines = await reportService.getTopSellingMedicines(req.user.branchId, limit);
    res.status(200).json(new ApiResponse(200, topMedicines, 'Top selling medicines fetched'));
});

const getGstReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const gstData = await reportService.getGstSummaryReport(req.user.branchId, startDate, endDate);
    res.status(200).json(new ApiResponse(200, gstData, 'GST report fetched successfully'));
});

module.exports = {
    getDashboardStats,
    getSalesReport,
    getTopSellingMedicines,
    getGstReport,
};
