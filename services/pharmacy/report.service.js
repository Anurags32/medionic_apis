const mongoose = require('mongoose');
const { Invoice, Order, User, Branch, Medicine } = require('../../models/pharmacy');
const inventoryService = require('./inventory.service');
const staffService = require('./staff.service');
const reportCache = require('../../utils/pharmacyCache');

const getDashboardStats = async (branchId) => {
    const cacheKey = `branch:${branchId}:dashboard_stats`;
    const cached = reportCache.get(cacheKey);
    if (cached) return cached;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const [todayAgg, monthAgg, pendingOrdersCount, staffCounts, alertCounts, branch] = await Promise.all([
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
        staffService.getStaffCounts(branchId),
        inventoryService.getStockCounts(branchId, 60),
        Branch.findById(branchObjectId),
    ]);

    const subscription = branch ? branch.getSubscriptionDetails() : null;
    const storeName = branch?.name || '';
    const storeCity = branch?.city || (branch?.extractCityFromAddress ? branch.extractCityFromAddress() : '');

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

        // Staff counts - unambiguous separate fields from one service
        totalStaff: staffCounts.totalStaff,
        onDutyNow: staffCounts.onDutyNow,
        blocked: staffCounts.blocked,
        inactive: staffCounts.inactive,
        offDuty: staffCounts.offDuty,
        total_staff: staffCounts.totalStaff,
        on_duty_now: staffCounts.onDutyNow,
        blocked_staff: staffCounts.blocked,
        inactive_staff: staffCounts.inactive,
        active_staff: staffCounts.onDutyNow,
        staff_summary: staffCounts,

        // Stock counts - from one getStockCounts function
        low_stock_medicines: alertCounts.lowStockCount,
        expiring_batches_60d: alertCounts.expiringSoonCount,
        lowStockCount: alertCounts.lowStockCount,
        outOfStockCount: alertCounts.outOfStockCount,
        expiringSoonCount: alertCounts.expiringSoonCount,
        expiredCount: alertCounts.expiredCount,
        low_stock_count: alertCounts.lowStockCount,
        out_of_stock_count: alertCounts.outOfStockCount,
        expiring_soon_count: alertCounts.expiringSoonCount,
        expired_count: alertCounts.expiredCount,
        inventory_status: {
            low_stock_count: alertCounts.lowStockCount,
            out_of_stock_count: alertCounts.outOfStockCount,
            expiring_soon_count: alertCounts.expiringSoonCount,
            expired_count: alertCounts.expiredCount,
        },
        stock_counts: {
            lowStockCount: alertCounts.lowStockCount,
            outOfStockCount: alertCounts.outOfStockCount,
            expiringSoonCount: alertCounts.expiringSoonCount,
            expiredCount: alertCounts.expiredCount,
        },

        // Store identity
        store_name: storeName,
        storeName: storeName,
        city: storeCity,
        branch_name: storeName,
        store: branch
            ? {
                  id: branch._id.toString(),
                  name: storeName,
                  store_name: storeName,
                  city: storeCity,
                  address: branch.address,
                  pincode: branch.pincode,
                  phone: branch.contact_number,
              }
            : null,

        // Subscription details
        subscription,
        plan: subscription,
        subscription_status: subscription?.status || 'ACTIVE',
        days_left: subscription?.daysLeft !== undefined ? subscription.daysLeft : 30,
        daysLeft: subscription?.daysLeft !== undefined ? subscription.daysLeft : 30,
        graceDaysLeft: subscription?.graceDaysLeft !== undefined ? subscription.graceDaysLeft : 0,
        isReadOnly: Boolean(subscription?.isReadOnly),
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
            expired: alertData.expiredBatches,
            lowStockCount: alertData.lowStockCount,
            outOfStockCount: alertData.outOfStockCount,
            expiringSoonCount: alertData.expiringSoonCount,
            expiredCount: alertData.expiredCount,
            low_stock_count: alertData.lowStockCount,
            out_of_stock_count: alertData.outOfStockCount,
            expiring_soon_count: alertData.expiringSoonCount,
            expired_count: alertData.expiredCount,
        },
        recent_low_stock: alertData.lowStockMedicines.slice(0, 5),
        recent_expiring: alertData.expiringBatches.slice(0, 5),
        subscription: stats.subscription,
    };

    reportCache.set(cacheKey, result, 15);
    return result;
};

const getInventoryMovementReport = async (branchId) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fastMoving = await Invoice.aggregate([
        { $match: { branch_id: branchObjectId, invoice_date: { $gte: thirtyDaysAgo } } },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.medicine_id',
                medicine_name: { $first: '$items.medicine_name' },
                total_quantity_sold: { $sum: '$items.quantity' },
                total_revenue: { $sum: '$items.total_amount' },
            },
        },
        { $sort: { total_quantity_sold: -1 } },
        { $limit: 15 },
    ]);

    const soldMedicineIds = fastMoving.map(m => m._id);
    const slowMoving = await Medicine.find({
        branch_id: branchObjectId,
        _id: { $nin: soldMedicineIds },
        is_active: true,
    }).select('name generic_name manufacturer current_stock sale_price').limit(15);

    return {
        period: 'Last 30 Days',
        fast_moving: fastMoving.map(f => ({
            medicine_id: f._id,
            name: f.medicine_name,
            total_sold: f.total_quantity_sold,
            revenue: f.total_revenue,
        })),
        slow_moving: slowMoving.map(s => ({
            medicine_id: s._id,
            name: s.name,
            generic_name: s.generic_name,
            current_stock: s.current_stock || 0,
            sale_price: s.sale_price,
        })),
    };
};

const getPnlReport = async (branchId, query = {}) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const { startDate, endDate, period } = query;
    const match = { branch_id: branchObjectId };

    if (period === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        match.invoice_date = { $gte: today };
    } else if (startDate && endDate) {
        match.invoice_date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate + 'T23:59:59.999Z'),
        };
    }

    const invoices = await Invoice.find(match).select('subtotal grand_total discount_amount cgst_amount sgst_amount items');

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let estimatedCostOfGoods = 0;

    for (const inv of invoices) {
        totalRevenue += inv.grand_total || 0;
        totalDiscount += inv.discount_amount || 0;
        totalTax += (inv.cgst_amount || 0) + (inv.sgst_amount || 0);
        for (const item of (inv.items || [])) {
            const purchaseRate = item.purchase_rate || (item.sale_price ? item.sale_price * 0.7 : 0);
            estimatedCostOfGoods += purchaseRate * (item.quantity || 1);
        }
    }

    const netSales = totalRevenue - totalTax;
    const grossProfit = Math.max(0, netSales - estimatedCostOfGoods);
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    return {
        period: period || 'all_time',
        total_revenue: Math.round(totalRevenue * 100) / 100,
        net_sales: Math.round(netSales * 100) / 100,
        total_discount: Math.round(totalDiscount * 100) / 100,
        total_tax: Math.round(totalTax * 100) / 100,
        cost_of_goods_sold: Math.round(estimatedCostOfGoods * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        gross_margin_percent: Math.round(grossMarginPercent * 100) / 100,
    };
};

module.exports = {
    getDashboardStats,
    getAggregatedDashboard,
    getSalesReport,
    getTopSellingMedicines,
    getGstSummaryReport,
    getInventoryMovementReport,
    getPnlReport,
};
