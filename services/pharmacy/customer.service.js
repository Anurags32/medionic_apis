const { Customer, Invoice, Order } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');


const createCustomer = async (branchId, payload) => {
    const { name, phone, email, address, city, pincode } = payload;

    const existing = await Customer.findOne({
        branch_id: branchId,
        phone: phone.trim(),
    });

    if (existing) {
        return existing;
    }

    const customer = await Customer.create({
        branch_id: branchId,
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim().toLowerCase() : null,
        address: address || '',
        city: city || '',
        pincode: pincode || '',
        khata_balance: 0.0,
    });

    return customer;
};

const getCustomers = async (branchId, query = {}) => {
    const { search, page = 1, limit = 50 } = query;
    const filter = { branch_id: branchId, is_active: true };

    if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { name: regex },
            { phone: regex },
            { email: regex },
        ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
        Customer.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limitNum),
        Customer.countDocuments(filter),
    ]);

    return {
        customers,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

const getCustomerById = async (branchId, customerId) => {
    const customer = await Customer.findOne({
        _id: customerId,
        branch_id: branchId,
    });

    if (!customer) {
        throw new ApiError(404, 'Customer not found in this branch', 'CUSTOMER_NOT_FOUND');
    }

    const [invoices, orders] = await Promise.all([
        Invoice.find({ customer_id: customer._id, branch_id: branchId })
            .sort({ invoice_date: -1 })
            .limit(10),
        Order.find({ customer_id: customer._id, branch_id: branchId })
            .sort({ created_at: -1 })
            .limit(10),
    ]);

    const result = customer.toJSON();
    result.invoices = invoices;
    result.orders = orders;

    return result;
};

const settleKhataPayment = async (branchId, customerId, amount, paymentMode, notes) => {
    const customer = await Customer.findOne({
        _id: customerId,
        branch_id: branchId,
    });

    if (!customer) {
        throw new ApiError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const payAmount = parseFloat(amount);
    const newBalance = Math.max(0, (customer.khata_balance || 0) - payAmount);
    customer.khata_balance = newBalance;
    await customer.save();

    return {
        customer_id: customer._id.toString(),
        name: customer.name,
        amount_settled: payAmount,
        remaining_khata_balance: newBalance,
        payment_mode: paymentMode,
        notes: notes || 'Khata Settlement',
    };
};

const getCustomerLedger = async (branchId, customerId) => {
    const customer = await Customer.findOne({
        _id: customerId,
        branch_id: branchId,
    });

    if (!customer) {
        throw new ApiError(404, 'Customer not found in this branch', 'CUSTOMER_NOT_FOUND');
    }

    const invoices = await Invoice.find({ customer_id: customer._id, branch_id: branchId })
        .sort({ invoice_date: -1 });

    return {
        customer_id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        khata_balance: customer.khata_balance || 0,
        ledger: invoices.map(inv => ({
            id: inv._id.toString(),
            invoice_number: inv.invoice_number,
            date: inv.invoice_date,
            total_amount: inv.grand_total,
            amount_paid: inv.amount_paid,
            balance_due: inv.balance_due,
            payment_mode: inv.payment_mode,
            payment_status: inv.payment_status,
        })),
    };
};

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    settleKhataPayment,
    getCustomerLedger,
};
