const mongoose = require('mongoose');
const { Invoice, Order, Medicine, MedicineBatch, User } = require('../../models/pharmacy');


const getDashboardStats = async (branchId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const branchObjectId = new mongoose.Types.ObjectId(branchId);

    const [todayAgg, monthAgg, pendingOrdersCount, staffCount, medicines, expiringBatchesCount] = await Promise.all([
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
        Medicine.find({ branch_id: branchObjectId, is_active: true }).populate({
            path: 'batches',
            match: { is_active: true },
        }),
        MedicineBatch.countDocuments({
            branch_id: branchObjectId,
            is_active: true,
            current_stock: { $gt: 0 },
            expiry_date: { $lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
        }),
    ]);

    let lowStockCount = 0;
    for (const med of medicines) {
        const total = (med.batches || []).reduce((acc, b) => acc + (b.current_stock || 0), 0);
        if (total <= (med.low_stock_threshold || 10)) {
            lowStockCount++;
        }
    }

    return {
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
        low_stock_medicines: lowStockCount,
        expiring_batches_60d: expiringBatchesCount,
    };
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

module.exports = {
    getDashboardStats,
    getSalesReport,
    getTopSellingMedicines,
    getGstSummaryReport,
};
