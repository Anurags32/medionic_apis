const mongoose = require('mongoose');
const { Invoice, Order, User, Branch } = require('../../models/pharmacy');
const inventoryService = require('./inventory.service');
const reportCache = require('../../utils/pharmacyCache');

const getDashboardStats = async (branchId) => {
    const cacheKey = `branch:${branchId}:dashboard_stats`;
    const cached = reportCache.get(cacheKey);
    if (cached) return cached;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const [todayAgg, monthAgg, pendingOrdersCount, staffCount, alertCounts, branch] = await Promise.all([
        Invoice.aggregate([
            { $match: { branch_id: branchObjectId, invoice_date: { $gte: today } } },
            {
                $group: {
                    _id: null,
                    total_sales_today: { $sum: '$grand_total' },
                    total_invoices_today: { $sum: 1 },
                },
            },
        ]),
        Invoice.aggregate([
            { $match: { branch_id: branchObjectId, invoice_date: { $gte: firstDayOfMonth } } },
            {
                $group: {
                    _id: null,
                    total_sales_month: { $sum: '$grand_total' },
                    total_invoices_month: { $sum: 1 },
                },
            },
        ]),
        Order.countDocuments({
            branch_id: branchObjectId,
            status: { $in: ['PLACED', 'CONFIRMED', 'PACKING'] },
        }),
        User.countDocuments({
            branch_id: branchObjectId,
            is_active: true,
            is_blocked: false,
        }),
        inventoryService.getInventoryAlertCounts(branchId, 60),
        Branch.findById(branchObjectId),
    ]);

    const subscription = branch ? branch.getSubscriptionDetails() : null;

    const stats = {
        today: {
            sales: parseFloat(todayAgg[0]?.total_sales_today || 0),
            invoices: parseInt(todayAgg[0]?.total_invoices_today || 0),
        },
        month: {
            sales: parseFloat(monthAgg[0]?.total_sales_month || 0),
            invoices: parseInt(monthAgg[0]?.total_invoices_month || 0),
        },
        pending_orders: pendingOrdersCount,
        active_staff: staffCount,
        low_stock_medicines: alertCounts.lowStockCount,
        expiring_batches_60d: alertCounts.expiringBatchesCount,
        low_stock_count: alertCounts.lowStockCount,
        expiring_soon_count: alertCounts.expiringBatchesCount,
        inventory_status: {
            low_stock_count: alertCounts.lowStockCount,
            expiring_soon_count: alertCounts.expiringBatchesCount,
        },
        subscription,
        plan: subscription,
        subscription_status: subscription?.status || 'ACTIVE',
        days_left: subscription?.daysLeft !== undefined ? subscription.daysLeft : 30,
    };

    reportCache.set(cacheKey, stats, 15);
    return stats;
};

const getSalesReport = async (branchId, startDate, endDate) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const match = { branch_id: branchObjectId };

    if (startDate && endDate) {
        match.invoice_date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate + 'T23:59:59.999Z'),
        };
    }

    const report = await Invoice.aggregate([
        { $match: match },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoice_date' } },
                invoice_count: { $sum: 1 },
                subtotal: { $sum: '$subtotal' },
                discount: { $sum: '$discount_amount' },
                cgst: { $sum: '$cgst_amount' },
                sgst: { $sum: '$sgst_amount' },
                total_revenue: { $sum: '$grand_total' },
            },
        },
        {
            $project: {
                date: '$_id',
                invoice_count: 1,
                subtotal: 1,
                discount: 1,
                cgst: 1,
                sgst: 1,
                total_revenue: 1,
                _id: 0,
            },
        },
        { $sort: { date: -1 } },
    ]);

    return report;
};

const getTopSellingMedicines = async (branchId, limit = 10) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const topItems = await Invoice.aggregate([
        { $match: { branch_id: branchObjectId } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.medicine_id',
                medicine_name: { $first: '$items.medicine_name' },
                total_qty_sold: { $sum: '$items.quantity' },
                total_revenue_generated: { $sum: '$items.total_amount' },
            },
        },
        {
            $project: {
                medicine_id: '$_id',
                medicine_name: 1,
                total_qty_sold: 1,
                total_revenue_generated: 1,
                _id: 0,
            },
        },
        { $sort: { total_qty_sold: -1 } },
        { $limit: parseInt(limit) || 10 },
    ]);

    return topItems;
};

const getGstSummaryReport = async (branchId, startDate, endDate) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const match = { branch_id: branchObjectId };

    if (startDate && endDate) {
        match.invoice_date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate + 'T23:59:59.999Z'),
        };
    }

    const summary = await Invoice.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                taxable_value: { $sum: '$subtotal' },
                total_cgst: { $sum: '$cgst_amount' },
                total_sgst: { $sum: '$sgst_amount' },
                total_igst: { $sum: '$igst_amount' },
                total_invoiced_value: { $sum: '$grand_total' },
                total_invoices: { $sum: 1 },
            },
        },
    ]);

    return summary[0] || {
        taxable_value: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        total_invoiced_value: 0,
        total_invoices: 0,
    };
};

const getAggregatedDashboard = async (branchId) => {
    const cacheKey = `branch:${branchId}:aggregated_dashboard`;
    const cached = reportCache.get(cacheKey);
    if (cached) return cached;

    const [stats, topMedicines, gstSummary, alertData] = await Promise.all([
        getDashboardStats(branchId),
        getTopSellingMedicines(branchId, 5),
        getGstSummaryReport(branchId),
        inventoryService.getInventoryAlertCounts(branchId, 60),
    ]);

    const result = {
        ...stats,
        stats,
        dashboard: stats,
        top_medicines: topMedicines,
        gst_summary: gstSummary,
        alerts: {
            low_stock: alertData.lowStockMedicines,
            expiring: alertData.expiringBatches,
            low_stock_count: alertData.lowStockCount,
            expiring_soon_count: alertData.expiringBatchesCount,
        },
        recent_low_stock: alertData.lowStockMedicines.slice(0, 5),
        recent_expiring: alertData.expiringBatches.slice(0, 5),
        subscription: stats.subscription,
    };

    reportCache.set(cacheKey, result, 15);
    return result;
};

module.exports = {
    getDashboardStats,
    getAggregatedDashboard,
    getSalesReport,
    getTopSellingMedicines,
    getGstSummaryReport,
};
