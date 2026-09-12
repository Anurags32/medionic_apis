const {
    Order,
    Medicine,
    MedicineBatch,
    Customer,
    Prescription,
    Invoice,
    StockLog,
    User,
    Branch,
} = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const {
    ORDER_STATUS,
    ORDER_TYPES,
    ORDER_TYPE,
    PAYMENT_MODES,
    PAYMENT_STATUS,
    STOCK_TRANSACTION_TYPES,
    STOCK_LOG_TYPES,
} = require('../../config/pharmacyConstants');
const { emitToBranch, emitToUser } = require('../../socket/pharmacyEvents');


const ALLOWED_STATUS_TRANSITIONS = {
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PACKING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PACKING]: [ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PACKED]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.DELIVERED]: [],
    [ORDER_STATUS.CANCELLED]: [],
};

const generateOrderNumber = async (branchId) => {
    const branch = await Branch.findById(branchId);
    const branchCode = branch ? branch.code : 'MC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${branchCode}-${dateStr}-${randomSuffix}`;
};

const generateInvoiceNumber = async (branchId) => {
    const branch = await Branch.findById(branchId);
    const branchCode = branch ? branch.code : 'MC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${branchCode}-${dateStr}-${randomSuffix}`;
};

const createOrder = async (branchId, userId, payload) => {
    const {
        order_type,
        customer_id,
        customer_name,
        customer_phone,
        prescription_id,
        items,
        delivery_address,
        delivery_phone,
        delivery_city,
        delivery_pincode,
        payment_mode = PAYMENT_MODES.CASH,
        remarks,
    } = payload;

    if (!items || !items.length) {
        throw new ApiError(400, 'Order must contain at least one item', 'ITEMS_REQUIRED');
    }

    const effectivePhone = (delivery_phone || customer_phone || '').trim();
    const effectiveName = (customer_name || 'Delivery Customer').trim();
    let resolvedCustomerId = customer_id || null;

    if (!resolvedCustomerId && effectivePhone) {
        let existingCustomer = await Customer.findOne({
            branch_id: branchId,
            phone: effectivePhone,
        });

        if (!existingCustomer) {
            existingCustomer = await Customer.create({
                branch_id: branchId,
                name: effectiveName,
                phone: effectivePhone,
                address: delivery_address || '',
                city: delivery_city || '',
                pincode: delivery_pincode || '',
                khata_balance: 0,
            });
        }
        resolvedCustomerId = existingCustomer._id;
    }

    const determinedOrderType = order_type || (delivery_address ? ORDER_TYPES?.DELIVERY || 'DELIVERY' : ORDER_TYPE?.POS || 'POS');

    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    let netAmount = 0;

    const preparedItems = [];

    for (const item of items) {
        const { medicine_id, quantity, discount_percent = 0 } = item;
        let batch_id = item.batch_id;

        let batch;
        if (batch_id) {
            batch = await MedicineBatch.findOne({
                _id: batch_id,
                medicine_id,
                branch_id: branchId,
            }).populate('medicine');
        } else {
            // Auto pick batch with available stock (FEFO - First Expiry First Out)
            batch = await MedicineBatch.findOne({
                medicine_id,
                branch_id: branchId,
                current_stock: { $gte: quantity },
                expiry_date: { $gte: new Date() },
            })
                .sort({ expiry_date: 1 })
                .populate('medicine');
        }

        if (!batch) {
            throw new ApiError(404, `No suitable batch with sufficient stock found for medicine ${medicine_id}`, 'BATCH_NOT_FOUND');
        }

        const unitPrice = parseFloat(batch.sale_price || batch.mrp);
        const lineSubtotal = unitPrice * quantity;
        const lineDiscount = (lineSubtotal * parseFloat(discount_percent || 0)) / 100;
        const taxable = lineSubtotal - lineDiscount;
        const gstRate = parseFloat(batch.gst_rate || 12);
        const lineGst = (taxable * gstRate) / 100;
        const lineTotal = taxable + lineGst;

        subtotal += lineSubtotal;
        discountAmount += lineDiscount;
        taxAmount += lineGst;
        netAmount += lineTotal;

        preparedItems.push({
            medicine_id: batch.medicine_id,
            batch_id: batch._id,
            quantity,
            unit_price: unitPrice,
            mrp: batch.mrp,
            gst_rate: gstRate,
            gst_amount: lineGst,
            discount_amount: lineDiscount,
            total_amount: lineTotal,
        });
    }

    const orderNumber = await generateOrderNumber(branchId);

    const newOrder = await Order.create({
        branch_id: branchId,
        customer_id: resolvedCustomerId,
        prescription_id: prescription_id || null,
        order_number: orderNumber,
        order_type: determinedOrderType,
        status: ORDER_STATUS.PLACED,
        delivery_address: delivery_address || null,
        delivery_phone: effectivePhone || null,
        delivery_pincode: delivery_pincode || null,
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: Math.round(discountAmount * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        net_amount: Math.round(netAmount * 100) / 100,
        payment_mode,
        payment_status: PAYMENT_STATUS.PENDING,
        created_by_user_id: userId,
        remarks: remarks || null,
        items: preparedItems,
    });

    emitToBranch(branchId.toString(), 'order:created', {
        orderId: newOrder._id.toString(),
        orderNumber: newOrder.order_number,
        orderType: newOrder.order_type,
        netAmount: newOrder.net_amount,
        deliveryAddress: newOrder.delivery_address,
        message: `Order ${newOrder.order_number} created for ${effectiveName}`,
    });

    return getOrderById(branchId, newOrder._id);
};

const acceptOrder = async (branchId, userId, orderId) => {
    const order = await Order.findOne({
        _id: orderId,
        branch_id: branchId,
    }).populate('customer');

    if (!order) {
        throw new ApiError(404, 'Order not found in this branch', 'ORDER_NOT_FOUND');
    }

    if (order.status !== ORDER_STATUS.PLACED) {
        throw new ApiError(
            400,
            `Cannot accept order with status '${order.status}'. Order has already been processed.`,
            'ORDER_ALREADY_PROCESSED'
        );
    }

    if (!order.items || order.items.length === 0) {
        throw new ApiError(400, 'Order has no items to accept', 'NO_ORDER_ITEMS');
    }

    let subtotal = 0;
    let totalDiscount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let grandTotal = 0;

    const preparedInvoiceItems = [];

    for (const item of order.items) {
        let batch = null;

        if (item.batch_id) {
            batch = await MedicineBatch.findOne({
                _id: item.batch_id,
                medicine_id: item.medicine_id,
                branch_id: branchId,
            }).populate('medicine');
        } else {
            batch = await MedicineBatch.findOne({
                medicine_id: item.medicine_id,
                branch_id: branchId,
                is_active: true,
                current_stock: { $gte: item.quantity },
            }).populate('medicine').sort({ expiry_date: 1 });
        }

        if (!batch) {
            throw new ApiError(
                400,
                `Insufficient stock or batch not found for medicine ${item.medicine_id}`,
                'INSUFFICIENT_STOCK'
            );
        }

        if (batch.current_stock < item.quantity) {
            throw new ApiError(
                400,
                `Insufficient stock for ${batch.medicine ? batch.medicine.name : 'Medicine'} (Batch: ${batch.batch_number}). Available: ${batch.current_stock}, Requested: ${item.quantity}`,
                'INSUFFICIENT_STOCK'
            );
        }

        const newStock = batch.current_stock - item.quantity;
        batch.current_stock = newStock;
        await batch.save();

        await StockLog.create({
            branch_id: branchId,
            medicine_id: batch.medicine_id,
            batch_id: batch._id,
            type: STOCK_TRANSACTION_TYPES?.SALE_OUT || STOCK_LOG_TYPES.SALE_OUT,
            quantity: -item.quantity,
            balance_after: newStock,
            reference_id: order.order_number,
            remarks: `Order Accepted (${order.order_number})`,
            created_by_user_id: userId,
        });

        const unitPrice = parseFloat(item.unit_price || batch.sale_price || batch.mrp);
        const lineSubtotal = unitPrice * item.quantity;
        const lineDiscount = parseFloat(item.discount_amount || 0);
        const taxableAmount = lineSubtotal - lineDiscount;

        const gstRate = parseFloat(batch.gst_rate || item.gst_rate || 12);
        const gstAmount = (taxableAmount * gstRate) / 100;
        const lineTotal = taxableAmount + gstAmount;

        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;
        totalCgst += gstAmount / 2;
        totalSgst += gstAmount / 2;
        grandTotal += lineTotal;

        preparedInvoiceItems.push({
            medicine_id: batch.medicine_id,
            batch_id: batch._id,
            medicine_name: batch.medicine ? batch.medicine.name : 'Medicine',
            batch_number: batch.batch_number,
            expiry_date: batch.expiry_date,
            hsn_code: batch.medicine?.hsn_code || '',
            quantity: item.quantity,
            unit_price: unitPrice,
            mrp: batch.mrp,
            discount_amount: lineDiscount,
            gst_rate: gstRate,
            gst_amount: gstAmount,
            total_amount: lineTotal,
        });
    }

    const invoiceNumber = await generateInvoiceNumber(branchId);
    const roundedGrandTotal = Math.round(grandTotal * 100) / 100;

    const invoice = await Invoice.create({
        branch_id: branchId,
        order_id: order._id,
        customer_id: order.customer_id || null,
        invoice_number: invoiceNumber,
        invoice_date: new Date(),
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: Math.round(totalDiscount * 100) / 100,
        total_tax: Math.round((totalCgst + totalSgst) * 100) / 100,
        cgst_amount: Math.round(totalCgst * 100) / 100,
        sgst_amount: Math.round(totalSgst * 100) / 100,
        igst_amount: 0.0,
        grand_total: roundedGrandTotal,
        payment_mode: order.payment_mode || PAYMENT_MODES.CASH,
        payment_status: order.payment_status || PAYMENT_STATUS.PENDING,
        created_by_user_id: userId,
        items: preparedInvoiceItems,
    });

    order.status = ORDER_STATUS.CONFIRMED;
    await order.save();

    emitToBranch(branchId.toString(), 'order:status_updated', {
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        status: ORDER_STATUS.CONFIRMED,
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoice_number,
        message: `Order ${order.order_number} confirmed. Invoice ${invoice.invoice_number} created.`,
    });

    emitToBranch(branchId.toString(), 'inventory:stock_updated', {
        message: `Stock updated for order ${order.order_number}`,
    });

    return getOrderById(branchId, order._id);
};

const getOrders = async (branchId, query = {}) => {
    const { status, order_type, customer_id, page = 1, limit = 20 } = query;
    const filter = { branch_id: branchId };

    if (status) filter.status = status;
    if (order_type) filter.order_type = order_type;
    if (customer_id) filter.customer_id = customer_id;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate('customer', 'name phone')
            .populate('assigned_packer', 'full_name')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limitNum),
        Order.countDocuments(filter),
    ]);

    return {
        orders,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

const getOrderById = async (branchId, orderId) => {
    const order = await Order.findOne({
        _id: orderId,
        branch_id: branchId,
    })
        .populate('customer')
        .populate('prescription')
        .populate('assigned_packer', 'full_name email')
        .populate('created_by', 'full_name email')
        .populate('items.medicine_id', 'name generic_name')
        .populate('items.batch_id', 'batch_number expiry_date mrp sale_price current_stock');

    if (!order) {
        throw new ApiError(404, 'Order not found in this branch', 'ORDER_NOT_FOUND');
    }

    return order;
};

const updateOrderStatus = async (branchId, orderId, status, remarks = null) => {
    const order = await Order.findOne({ _id: orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    if (!Object.values(ORDER_STATUS).includes(status)) {
        throw new ApiError(400, `Invalid order status: '${status}'`, 'INVALID_STATUS');
    }

    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes(status) && order.status !== status) {
        throw new ApiError(
            400,
            `Illegal status transition from '${order.status}' to '${status}'. Allowed next states: [${allowedTransitions.join(', ') || 'None (Terminal)'}]`,
            'ILLEGAL_STATUS_TRANSITION'
        );
    }

    order.status = status;
    if (remarks) order.remarks = remarks;
    await order.save();

    emitToBranch(branchId.toString(), 'order:status_updated', {
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        status: order.status,
        message: `Order ${order.order_number} status updated to ${status}`,
    });

    return order;
};

const assignPacker = async (branchId, orderId, packerId) => {
    const order = await Order.findOne({ _id: orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    const packer = await User.findOne({ _id: packerId, branch_id: branchId });
    if (!packer) {
        throw new ApiError(404, 'Packer user not found in this branch', 'USER_NOT_FOUND');
    }

    order.assigned_packer_id = packerId;
    order.status = ORDER_STATUS.PACKING;
    await order.save();

    emitToUser(packerId.toString(), 'order:assigned', {
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        message: `You have been assigned to pack Order ${order.order_number}`,
    });

    emitToBranch(branchId.toString(), 'order:status_updated', {
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        status: order.status,
        packerName: packer.full_name,
        message: `Order ${order.order_number} assigned to packer ${packer.full_name}`,
    });

    return order;
};

module.exports = {
    createOrder,
    acceptOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    assignPacker,
};
