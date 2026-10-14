const mongoose = require('mongoose');
const PharmacyReturn = require('../../models/pharmacy/return.model');
const MedicineBatch = require('../../models/pharmacy/batch.model');
const Medicine = require('../../models/pharmacy/medicine.model');
const StockLog = require('../../models/pharmacy/stock-log.model');
const ApiError = require('../../utils/ApiError');
const { STOCK_LOG_TYPES, STOCK_TRANSACTION_TYPES } = require('../../config/pharmacyConstants');
const { emitToBranch } = require('../../socket/pharmacyEvents');

/**
 * Generate next return number for a branch (e.g., RET-1001)
 */
const generateReturnNumber = async (branchId) => {
    const count = await PharmacyReturn.countDocuments({ branch_id: branchId });
    const sequence = 1001 + count;
    let returnNumber = `RET-${sequence}`;

    const exists = await PharmacyReturn.findOne({ return_number: returnNumber, branch_id: branchId });
    if (exists) {
        returnNumber = `RET-${sequence}-${Date.now().toString().slice(-4)}`;
    }
    return returnNumber;
};

/**
 * Get paginated list of returns
 */
const getReturns = async (branchId, query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { branch_id: branchId };

    if (query.status) {
        filter.status = query.status.toUpperCase();
    }

    if (query.search) {
        const regex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
            { return_number: regex },
            { customer_name: regex },
            { customer_phone: regex },
        ];
    }

    const [returns, total] = await Promise.all([
        PharmacyReturn.find(filter)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('created_by', 'name email role')
            .populate('inspected_by', 'name email role')
            .lean(),
        PharmacyReturn.countDocuments(filter),
    ]);

    return {
        returns,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1,
        },
    };
};

/**
 * Get return by ID
 */
const getReturnById = async (branchId, returnId) => {
    if (!mongoose.Types.ObjectId.isValid(returnId)) {
        throw new ApiError(400, 'Invalid return ID format', 'INVALID_RETURN_ID');
    }

    const returnDoc = await PharmacyReturn.findOne({
        _id: returnId,
        branch_id: branchId,
    })
        .populate('created_by', 'name email role')
        .populate('inspected_by', 'name email role')
        .populate('items.medicine_id', 'name generic_name dosage_form strength')
        .populate('items.batch_id', 'batch_number expiry_date current_stock mrp')
        .lean();

    if (!returnDoc) {
        throw new ApiError(404, 'Return request not found', 'RETURN_NOT_FOUND');
    }

    return returnDoc;
};

/**
 * Create a new return request
 */
const createReturn = async (branchId, userId, payload) => {
    const {
        items,
        invoice_id,
        order_id,
        customer_name,
        customer_phone,
        total_refund_amount,
        inspection_notes,
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'At least one return item is required', 'ITEMS_REQUIRED');
    }

    const return_number = await generateReturnNumber(branchId);

    const processedItems = [];
    let calculatedRefund = 0;

    for (const item of items) {
        if (!item.batch_id || !item.quantity || item.quantity <= 0) {
            throw new ApiError(400, 'Valid batch_id and quantity > 0 are required for each return item', 'INVALID_ITEM_DATA');
        }

        const batch = await MedicineBatch.findOne({
            _id: item.batch_id,
            branch_id: branchId,
        }).populate('medicine');

        if (!batch) {
            throw new ApiError(404, `Batch ${item.batch_id} not found in this branch`, 'BATCH_NOT_FOUND');
        }

        const unitPrice = parseFloat(item.unit_price) || batch.mrp || 0;
        const qty = parseInt(item.quantity, 10);
        const itemTotal = unitPrice * qty;
        calculatedRefund += itemTotal;

        processedItems.push({
            medicine_id: batch.medicine_id,
            medicine_name: batch.medicine ? batch.medicine.name : 'Unknown Medicine',
            batch_id: batch._id,
            batch_number: batch.batch_number,
            quantity: qty,
            unit_price: unitPrice,
            total_amount: itemTotal,
            reason: item.reason || 'Customer Return',
            condition: item.condition || 'GOOD',
            action: item.action || 'PENDING',
        });
    }

    const newReturn = await PharmacyReturn.create({
        return_number,
        branch_id: branchId,
        invoice_id: invoice_id || null,
        order_id: order_id || null,
        customer_name: customer_name || '',
        customer_phone: customer_phone || '',
        items: processedItems,
        total_refund_amount: total_refund_amount !== undefined ? total_refund_amount : calculatedRefund,
        status: 'PENDING',
        inspection_notes: inspection_notes || '',
        created_by: userId,
    });

    emitToBranch(branchId.toString(), 'return:created', {
        returnId: newReturn._id,
        returnNumber: newReturn.return_number,
    });

    return newReturn;
};

/**
 * Inspect a return request
 */
const inspectReturn = async (branchId, userId, returnId, inspectionData) => {
    if (!mongoose.Types.ObjectId.isValid(returnId)) {
        throw new ApiError(400, 'Invalid return ID format', 'INVALID_RETURN_ID');
    }

    const returnDoc = await PharmacyReturn.findOne({
        _id: returnId,
        branch_id: branchId,
    });

    if (!returnDoc) {
        throw new ApiError(404, 'Return request not found', 'RETURN_NOT_FOUND');
    }

    if (returnDoc.status === 'COMPLETED' || returnDoc.status === 'REJECTED') {
        throw new ApiError(400, `Return already in ${returnDoc.status} state`, 'RETURN_ALREADY_CLOSED');
    }

    const {
        items_inspection = [],
        inspection_notes = '',
        status = 'INSPECTED',
        auto_process_actions = false,
    } = inspectionData;

    returnDoc.inspected_by = userId;
    returnDoc.inspected_at = new Date();
    if (inspection_notes) {
        returnDoc.inspection_notes = inspection_notes;
    }

    // Update item-level condition and actions
    if (Array.isArray(items_inspection)) {
        for (const itemInsp of items_inspection) {
            const targetItem = returnDoc.items.id(itemInsp.item_id) ||
                returnDoc.items.find((i) => i.batch_id.toString() === itemInsp.batch_id);

            if (targetItem) {
                if (itemInsp.condition) targetItem.condition = itemInsp.condition;
                if (itemInsp.action) targetItem.action = itemInsp.action;
                if (itemInsp.reason) targetItem.reason = itemInsp.reason;
            }
        }
    }

    returnDoc.status = status;
    await returnDoc.save();

    // If auto_process_actions is requested, perform restock / dispose immediately
    if (auto_process_actions) {
        for (const item of returnDoc.items) {
            if (item.action === 'RESTOCK' && item.restocked_quantity === 0) {
                await restockItem(branchId, userId, returnDoc, item);
            } else if (item.action === 'DISPOSE' && item.disposed_quantity === 0) {
                await disposeItem(branchId, userId, returnDoc, item);
            }
        }
        returnDoc.status = 'COMPLETED';
        await returnDoc.save();
    }

    emitToBranch(branchId.toString(), 'return:inspected', {
        returnId: returnDoc._id,
        returnNumber: returnDoc.return_number,
        status: returnDoc.status,
    });

    return returnDoc;
};

/**
 * Helper to restock a returned item
 */
const restockItem = async (branchId, userId, returnDoc, item) => {
    const batch = await MedicineBatch.findOne({
        _id: item.batch_id,
        branch_id: branchId,
    });

    if (!batch) {
        throw new ApiError(404, `Batch not found for restock: ${item.batch_id}`, 'BATCH_NOT_FOUND');
    }

    const qtyToRestock = item.quantity - (item.restocked_quantity || 0);
    if (qtyToRestock <= 0) return;

    batch.current_stock += qtyToRestock;
    await batch.save();

    item.restocked_quantity = (item.restocked_quantity || 0) + qtyToRestock;
    item.action = 'RESTOCK';

    const logType = STOCK_TRANSACTION_TYPES?.RETURN_IN || STOCK_LOG_TYPES.RETURN_IN;

    await StockLog.create({
        branch_id: branchId,
        medicine_id: item.medicine_id,
        batch_id: batch._id,
        type: logType,
        quantity: qtyToRestock,
        balance_after: batch.current_stock,
        reference_id: returnDoc.return_number,
        remarks: `Customer Return Restocked (${returnDoc.return_number}): ${item.reason || 'Restocked after inspection'}`,
        created_by_user_id: userId,
    });

    emitToBranch(branchId.toString(), 'inventory:stock_updated', {
        batchId: batch._id.toString(),
        medicineId: item.medicine_id.toString(),
        newStock: batch.current_stock,
    });
};

/**
 * Helper to dispose a damaged or expired returned item
 */
const disposeItem = async (branchId, userId, returnDoc, item) => {
    const qtyToDispose = item.quantity - (item.disposed_quantity || 0);
    if (qtyToDispose <= 0) return;

    item.disposed_quantity = (item.disposed_quantity || 0) + qtyToDispose;
    item.action = 'DISPOSE';

    const logType = STOCK_TRANSACTION_TYPES?.DAMAGED_EXPIRED_OUT || STOCK_LOG_TYPES.DAMAGED_EXPIRED_OUT;

    await StockLog.create({
        branch_id: branchId,
        medicine_id: item.medicine_id,
        batch_id: item.batch_id,
        type: logType,
        quantity: 0,
        balance_after: 0,
        reference_id: returnDoc.return_number,
        remarks: `Customer Return Disposed (${returnDoc.return_number}) - condition: ${item.condition}. ${item.reason || ''}`,
        created_by_user_id: userId,
    });
};

/**
 * Restock specific or all eligible items from a return
 */
const restockReturn = async (branchId, userId, returnId, payload = {}) => {
    const returnDoc = await PharmacyReturn.findOne({
        _id: returnId,
        branch_id: branchId,
    });

    if (!returnDoc) {
        throw new ApiError(404, 'Return request not found', 'RETURN_NOT_FOUND');
    }

    const { item_id } = payload;
    const itemsToRestock = item_id
        ? returnDoc.items.filter((i) => i._id.toString() === item_id)
        : returnDoc.items.filter((i) => i.action !== 'DISPOSE');

    if (itemsToRestock.length === 0) {
        throw new ApiError(400, 'No eligible items found to restock', 'NO_RESTOCKABLE_ITEMS');
    }

    for (const item of itemsToRestock) {
        await restockItem(branchId, userId, returnDoc, item);
    }

    const allResolved = returnDoc.items.every(
        (i) => (i.restocked_quantity || 0) + (i.disposed_quantity || 0) >= i.quantity
    );
    if (allResolved) {
        returnDoc.status = 'RESTOCKED';
    }

    await returnDoc.save();

    return returnDoc;
};

/**
 * Dispose specific or all eligible items from a return
 */
const disposeReturn = async (branchId, userId, returnId, payload = {}) => {
    const returnDoc = await PharmacyReturn.findOne({
        _id: returnId,
        branch_id: branchId,
    });

    if (!returnDoc) {
        throw new ApiError(404, 'Return request not found', 'RETURN_NOT_FOUND');
    }

    const { item_id, reason } = payload;
    const itemsToDispose = item_id
        ? returnDoc.items.filter((i) => i._id.toString() === item_id)
        : returnDoc.items.filter((i) => i.action !== 'RESTOCK');

    if (itemsToDispose.length === 0) {
        throw new ApiError(400, 'No eligible items found to dispose', 'NO_DISPOSABLE_ITEMS');
    }

    for (const item of itemsToDispose) {
        if (reason) item.reason = reason;
        await disposeItem(branchId, userId, returnDoc, item);
    }

    const allResolved = returnDoc.items.every(
        (i) => (i.restocked_quantity || 0) + (i.disposed_quantity || 0) >= i.quantity
    );
    if (allResolved) {
        returnDoc.status = 'DISPOSED';
    }

    await returnDoc.save();

    return returnDoc;
};

module.exports = {
    getReturns,
    getReturnById,
    createReturn,
    inspectReturn,
    restockReturn,
    disposeReturn,
};
