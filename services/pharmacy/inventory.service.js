const mongoose = require('mongoose');
const { Medicine, MedicineBatch, Category, StockLog, Branch } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { STOCK_TRANSACTION_TYPES, STOCK_LOG_TYPES } = require('../../config/pharmacyConstants');
const { emitToBranch } = require('../../socket/pharmacyEvents');


const createCategory = async (branchId, payload) => {
    const { name, description } = payload;
    const category = await Category.create({
        branch_id: branchId,
        name,
        description,
    });
    return category;
};

const getCategories = async (branchId) => {
    return await Category.find({ branch_id: branchId, is_active: true }).sort({ name: 1 });
};

const createMedicine = async (branchId, payload, file) => {
    if (payload.batch_number || payload.batchNumber) {
        return await createMedicineWithBatch(branchId, payload.userId || null, payload, file);
    }

    const {
        category_id,
        name,
        generic_name,
        sku_barcode,
        manufacturer,
        hsn_code,
        form,
        unit,
        unit_quantity,
        is_prescription_required,
        low_stock_threshold,
        side_effects,
        storage_instructions,
        mrp,
        sale_price,
        purchase_rate,
        gst_rate,
    } = payload;

    const imageUrl = file ? `/uploads/medicines/${file.filename}` : null;

    const parsedMrp = mrp !== undefined && mrp !== null && mrp !== '' ? parseFloat(mrp) : 0;
    const parsedSalePrice =
        sale_price !== undefined && sale_price !== null && sale_price !== ''
            ? parseFloat(sale_price)
            : parsedMrp || 0;
    const parsedPurchaseRate =
        purchase_rate !== undefined && purchase_rate !== null && purchase_rate !== ''
            ? parseFloat(purchase_rate)
            : 0;
    const parsedGstRate =
        gst_rate !== undefined && gst_rate !== null && gst_rate !== '' ? parseFloat(gst_rate) : 0;

    let effectiveCategoryId = category_id;
    if (!effectiveCategoryId) {
        let defaultCat = await Category.findOne({ branch_id: branchId, is_active: true });
        if (!defaultCat) {
            defaultCat = await Category.create({
                branch_id: branchId,
                name: 'General',
                description: 'Default category',
            });
        }
        effectiveCategoryId = defaultCat._id;
    }

    const medicine = await Medicine.create({
        branch_id: branchId,
        category_id: effectiveCategoryId,
        name,
        generic_name,
        sku_barcode,
        manufacturer,
        hsn_code,
        form: form || 'Tablet',
        unit: unit || 'Strip',
        unit_quantity: unit_quantity ? parseInt(unit_quantity) : 10,
        is_prescription_required: is_prescription_required === true || is_prescription_required === 'true',
        low_stock_threshold: low_stock_threshold ? parseInt(low_stock_threshold) : 10,
        side_effects,
        storage_instructions,
        image_url: imageUrl,
        mrp: parsedMrp,
        sale_price: parsedSalePrice,
        purchase_rate: parsedPurchaseRate,
        gst_rate: parsedGstRate,
    });

    return medicine;
};

const updateMedicine = async (branchId, medicineId, payload, file) => {
    const medicine = await Medicine.findOne({ _id: medicineId, branch_id: branchId });
    if (!medicine) {
        throw new ApiError(404, 'Medicine not found in this branch', 'MEDICINE_NOT_FOUND');
    }

    const {
        category_id,
        name,
        generic_name,
        sku_barcode,
        manufacturer,
        hsn_code,
        form,
        unit,
        unit_quantity,
        is_prescription_required,
        low_stock_threshold,
        side_effects,
        storage_instructions,
        mrp,
        sale_price,
        purchase_rate,
        gst_rate,
        is_active,
    } = payload;

    if (name !== undefined) medicine.name = name;
    if (category_id !== undefined) medicine.category_id = category_id || null;
    if (generic_name !== undefined) medicine.generic_name = generic_name;
    if (sku_barcode !== undefined) medicine.sku_barcode = sku_barcode;
    if (manufacturer !== undefined) medicine.manufacturer = manufacturer;
    if (hsn_code !== undefined) medicine.hsn_code = hsn_code;
    if (form !== undefined) medicine.form = form;
    if (unit !== undefined) medicine.unit = unit;
    if (unit_quantity !== undefined) medicine.unit_quantity = parseInt(unit_quantity);
    if (is_prescription_required !== undefined)
        medicine.is_prescription_required = is_prescription_required === true || is_prescription_required === 'true';
    if (low_stock_threshold !== undefined) medicine.low_stock_threshold = parseInt(low_stock_threshold);
    if (side_effects !== undefined) medicine.side_effects = side_effects;
    if (storage_instructions !== undefined) medicine.storage_instructions = storage_instructions;
    if (mrp !== undefined) medicine.mrp = parseFloat(mrp);
    if (sale_price !== undefined) medicine.sale_price = parseFloat(sale_price);
    if (purchase_rate !== undefined) medicine.purchase_rate = parseFloat(purchase_rate);
    if (gst_rate !== undefined) medicine.gst_rate = parseFloat(gst_rate);
    if (is_active !== undefined) medicine.is_active = is_active === true || is_active === 'true';
    if (file) {
        medicine.image_url = `/uploads/medicines/${file.filename}`;
    }

    await medicine.save();
    return medicine;
};

const getMedicines = async (branchId, query = {}) => {
    const { search, category_id, is_prescription_required, page = 1, limit = 50 } = query;
    const filter = { branch_id: branchId, is_active: true };

    if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { name: regex },
            { generic_name: regex },
            { manufacturer: regex },
            { sku_barcode: regex },
        ];
    }

    if (category_id) {
        filter.category_id = category_id;
    }

    if (is_prescription_required !== undefined) {
        filter.is_prescription_required = is_prescription_required === 'true' || is_prescription_required === true;
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [medicines, total] = await Promise.all([
        Medicine.find(filter)
            .populate('category', 'name')
            .populate({
                path: 'batches',
                match: { is_active: true },
                select: 'batch_number expiry_date mrp sale_price current_stock gst_rate rack_location',
            })
            .sort({ name: 1 })
            .skip(skip)
            .limit(limitNum)
            .lean({ virtuals: true }),
        Medicine.countDocuments(filter),
    ]);

    const result = medicines.map((med) => {
        const medJson = { ...med, id: med._id ? med._id.toString() : med.id };
        let totalStock = 0;
        let sellableStock = 0;
        let hasExpired = false;

        const processedBatches = (medJson.batches || []).map((b) => {
            const bExpiry = new Date(b.expiry_date);
            const isExpired = bExpiry < today;
            if (isExpired) hasExpired = true;
            const stock = b.current_stock || 0;
            totalStock += stock;
            if (!isExpired) {
                sellableStock += stock;
            }
            return {
                ...b,
                expired: isExpired,
                is_expired: isExpired,
            };
        });

        medJson.batches = processedBatches;
        medJson.total_stock = totalStock;
        medJson.sellableQty = sellableStock;
        medJson.sellable_stock = sellableStock;
        medJson.expired = hasExpired;
        medJson.is_expired = hasExpired;
        medJson.is_low_stock = sellableStock <= (medJson.low_stock_threshold !== undefined ? medJson.low_stock_threshold : 10);

        // Fallback pricing if medicine level pricing is not set but batches exist
        if ((!medJson.mrp || medJson.mrp === 0) && processedBatches.length > 0) {
            medJson.mrp = processedBatches[0].mrp || 0;
        }
        if ((!medJson.sale_price || medJson.sale_price === 0) && processedBatches.length > 0) {
            medJson.sale_price = processedBatches[0].sale_price || medJson.mrp || 0;
        }
        if ((!medJson.purchase_rate || medJson.purchase_rate === 0) && processedBatches.length > 0) {
            medJson.purchase_rate = processedBatches[0].purchase_rate || 0;
        }
        if ((!medJson.gst_rate || medJson.gst_rate === 0) && processedBatches.length > 0) {
            medJson.gst_rate = processedBatches[0].gst_rate || 0;
        }

        return medJson;
    });

    return {
        medicines: result,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

const getMedicineById = async (branchId, medicineId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const medicine = await Medicine.findOne({
        _id: medicineId,
        branch_id: branchId,
    })
        .populate('category')
        .populate({
            path: 'batches',
            match: { is_active: true },
            options: { sort: { expiry_date: 1 } },
        });

    if (!medicine) {
        throw new ApiError(404, 'Medicine not found in this branch', 'MEDICINE_NOT_FOUND');
    }

    const medJson = medicine.toJSON();
    let totalStock = 0;
    let sellableStock = 0;
    let hasExpired = false;

    const processedBatches = (medJson.batches || []).map((b) => {
        const bExpiry = new Date(b.expiry_date);
        const isExpired = bExpiry < today;
        if (isExpired) hasExpired = true;
        const stock = b.current_stock || 0;
        totalStock += stock;
        if (!isExpired) {
            sellableStock += stock;
        }
        return {
            ...b,
            expired: isExpired,
            is_expired: isExpired,
        };
    });

    medJson.batches = processedBatches;
    medJson.total_stock = totalStock;
    medJson.sellableQty = sellableStock;
    medJson.sellable_stock = sellableStock;
    medJson.expired = hasExpired;
    medJson.is_expired = hasExpired;
    medJson.is_low_stock = sellableStock <= (medJson.low_stock_threshold !== undefined ? medJson.low_stock_threshold : 10);

    if ((!medJson.mrp || medJson.mrp === 0) && processedBatches.length > 0) {
        medJson.mrp = processedBatches[0].mrp || 0;
    }
    if ((!medJson.sale_price || medJson.sale_price === 0) && processedBatches.length > 0) {
        medJson.sale_price = processedBatches[0].sale_price || medJson.mrp || 0;
    }
    if ((!medJson.purchase_rate || medJson.purchase_rate === 0) && processedBatches.length > 0) {
        medJson.purchase_rate = processedBatches[0].purchase_rate || 0;
    }
    if ((!medJson.gst_rate || medJson.gst_rate === 0) && processedBatches.length > 0) {
        medJson.gst_rate = processedBatches[0].gst_rate || 0;
    }

    return medJson;
};

const createBatch = async (branchId, userId, payload) => {
    const {
        medicine_id,
        batch_number,
        mfg_date,
        expiry_date,
        purchase_rate,
        mrp,
        sale_price,
        gst_rate,
        initial_stock,
        quantity,
        rack_location,
    } = payload;

    const initialStockVal = initial_stock !== undefined ? initial_stock : (quantity !== undefined ? quantity : 0);

    const medicine = await Medicine.findOne({ _id: medicine_id, branch_id: branchId });
    if (!medicine) {
        throw new ApiError(404, 'Medicine not found in this branch', 'MEDICINE_NOT_FOUND');
    }

    const batch = await MedicineBatch.create({
        branch_id: branchId,
        medicine_id,
        batch_number,
        mfg_date: mfg_date || null,
        expiry_date,
        purchase_rate: purchase_rate || 0,
        mrp: mrp || 0,
        sale_price: sale_price || mrp,
        gst_rate: gst_rate || 12,
        current_stock: initialStockVal || 0,
        rack_location: rack_location || '',
    });

    if ((!medicine.mrp || medicine.mrp === 0) && mrp) {
        medicine.mrp = mrp;
        medicine.sale_price = sale_price || mrp;
        if (!medicine.purchase_rate && purchase_rate) medicine.purchase_rate = purchase_rate;
        if (!medicine.gst_rate && gst_rate) medicine.gst_rate = gst_rate;
        await medicine.save();
    }

    if (initial_stock && initial_stock > 0) {
        await StockLog.create({
            branch_id: branchId,
            medicine_id,
            batch_id: batch._id,
            type: STOCK_TRANSACTION_TYPES?.PURCHASE_IN || STOCK_LOG_TYPES.PURCHASE_IN,
            quantity: initial_stock,
            balance_after: initial_stock,
            unit_cost: purchase_rate || 0,
            remarks: 'Initial Batch Stocking',
            created_by_user_id: userId,
        });
    }

    return batch;
};

const adjustStock = async (branchId, userId, payload) => {
    let { batch_id, quantity_changed, transaction_type, reason, adjustment_type, quantity } = payload;

    if (quantity_changed === undefined && quantity !== undefined) {
        const qtyNum = parseInt(quantity, 10) || 0;
        if (adjustment_type === 'REDUCE') {
            quantity_changed = -Math.abs(qtyNum);
            transaction_type = transaction_type || 'DAMAGED_EXPIRED_OUT';
        } else {
            quantity_changed = Math.abs(qtyNum);
            transaction_type = transaction_type || 'ADJUSTMENT';
        }
    }

    const batch = await MedicineBatch.findOne({
        _id: batch_id,
        branch_id: branchId,
    }).populate('medicine');

    if (!batch) {
        throw new ApiError(404, 'Batch not found in this branch', 'BATCH_NOT_FOUND');
    }

    const newStock = batch.current_stock + parseInt(quantity_changed);
    if (newStock < 0) {
        throw new ApiError(400, `Insufficient stock. Current stock is ${batch.current_stock}`, 'INSUFFICIENT_STOCK');
    }

    batch.current_stock = newStock;
    await batch.save();

    const log = await StockLog.create({
        branch_id: branchId,
        medicine_id: batch.medicine_id,
        batch_id: batch._id,
        type: transaction_type === 'ADJUSTMENT_IN' ? 'ADJUSTMENT' : (transaction_type || 'ADJUSTMENT'),
        quantity: parseInt(quantity_changed),
        balance_after: newStock,
        remarks: reason || 'Manual Stock Adjustment',
        created_by_user_id: userId,
    });

    const allBatches = await MedicineBatch.find({
        medicine_id: batch.medicine_id,
        branch_id: branchId,
        is_active: true,
    });
    const totalCurrentStock = allBatches.reduce((sum, b) => sum + (b.current_stock || 0), 0);

    if (batch.medicine && totalCurrentStock <= (batch.medicine.low_stock_threshold || 10)) {
        emitToBranch(branchId.toString(), 'inventory:low_stock', {
            medicineId: batch.medicine_id.toString(),
            medicineName: batch.medicine.name,
            currentStock: totalCurrentStock,
            threshold: batch.medicine.low_stock_threshold,
            message: `Low stock alert for ${batch.medicine.name} (Current: ${totalCurrentStock})`,
        });
    }

    return {
        batch_id: batch._id.toString(),
        batch_number: batch.batch_number,
        medicine_name: batch.medicine ? batch.medicine.name : '',
        new_stock: newStock,
        log,
    };
};

const processReturn = async (branchId, userId, payload) => {
    const { batch_id, quantity, action = 'RESTOCK', reason, reference_id } = payload;

    if (!batch_id || !quantity || quantity <= 0) {
        throw new ApiError(400, 'Valid batch ID and quantity greater than 0 are required', 'INVALID_RETURN_DATA');
    }

    const batch = await MedicineBatch.findOne({
        _id: batch_id,
        branch_id: branchId,
    }).populate('medicine');

    if (!batch) {
        throw new ApiError(404, 'Batch not found in this branch', 'BATCH_NOT_FOUND');
    }

    const returnQty = parseInt(quantity);
    let newStock = batch.current_stock;
    let transactionType = STOCK_TRANSACTION_TYPES?.RETURN_IN || STOCK_LOG_TYPES.RETURN_IN;

    if (action === 'RESTOCK') {
        newStock = batch.current_stock + returnQty;
        batch.current_stock = newStock;
        await batch.save();
        transactionType = STOCK_TRANSACTION_TYPES?.RETURN_IN || STOCK_LOG_TYPES.RETURN_IN;
    } else if (action === 'DISPOSE') {
        transactionType = STOCK_TRANSACTION_TYPES?.DAMAGED_EXPIRED_OUT || STOCK_LOG_TYPES.DAMAGED_EXPIRED_OUT;
    } else {
        throw new ApiError(400, "Invalid return action. Must be 'RESTOCK' or 'DISPOSE'", 'INVALID_RETURN_ACTION');
    }

    const log = await StockLog.create({
        branch_id: branchId,
        medicine_id: batch.medicine_id,
        batch_id: batch._id,
        type: transactionType,
        quantity: action === 'RESTOCK' ? returnQty : 0,
        balance_after: newStock,
        reference_id: reference_id || null,
        remarks: reason || (action === 'RESTOCK' ? 'Customer Return (Restocked)' : 'Customer Return (Disposed/Damaged)'),
        created_by_user_id: userId,
    });

    emitToBranch(branchId.toString(), 'inventory:stock_updated', {
        batchId: batch._id.toString(),
        medicineId: batch.medicine_id.toString(),
        currentStock: newStock,
        action,
        message: `Inventory updated: ${batch.medicine ? batch.medicine.name : 'Medicine'} (${action})`,
    });

    return {
        batch_id: batch._id.toString(),
        medicine_name: batch.medicine ? batch.medicine.name : '',
        batch_number: batch.batch_number,
        action,
        current_stock: newStock,
        log,
    };
};

const lookupByBarcode = async (branchId, barcode) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const medicine = await Medicine.findOne({
        branch_id: branchId,
        sku_barcode: barcode,
        is_active: true,
    }).populate({
        path: 'batches',
        match: { is_active: true, current_stock: { $gt: 0 } },
        options: { sort: { expiry_date: 1 } },
    });

    if (!medicine) {
        throw new ApiError(404, `No active medicine found for barcode '${barcode}'`, 'BARCODE_NOT_FOUND');
    }

    const medJson = medicine.toJSON();
    let totalStock = 0;
    let sellableStock = 0;
    let hasExpired = false;

    medJson.batches = (medJson.batches || []).map((b) => {
        const isExpired = new Date(b.expiry_date) < today;
        if (isExpired) hasExpired = true;
        totalStock += b.current_stock || 0;
        if (!isExpired) {
            sellableStock += b.current_stock || 0;
        }
        return {
            ...b,
            expired: isExpired,
            is_expired: isExpired,
        };
    });

    medJson.total_stock = totalStock;
    medJson.sellableQty = sellableStock;
    medJson.sellable_stock = sellableStock;
    medJson.expired = hasExpired;
    medJson.is_expired = hasExpired;
    medJson.is_low_stock = sellableStock <= (medJson.low_stock_threshold || 10);

    if ((!medJson.mrp || medJson.mrp === 0) && medJson.batches && medJson.batches.length > 0) {
        medJson.mrp = medJson.batches[0].mrp || 0;
    }
    if ((!medJson.sale_price || medJson.sale_price === 0) && medJson.batches && medJson.batches.length > 0) {
        medJson.sale_price = medJson.batches[0].sale_price || medJson.mrp || 0;
    }

    return medJson;
};

const getStockCounts = async (branchId, days = 60) => {
    const branchObjectId = new mongoose.Types.ObjectId(branchId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + parseInt(days || 60));
    targetDate.setHours(23, 59, 59, 999);

    const medicines = await Medicine.find({
        branch_id: branchObjectId,
        is_active: true,
    }).populate({
        path: 'batches',
        match: { is_active: true },
    });

    const lowStockList = [];
    const outOfStockList = [];

    for (const med of medicines) {
        const medJson = med.toJSON();
        const nonExpiredBatches = (medJson.batches || []).filter((b) => new Date(b.expiry_date) >= today);
        const sellableStock = nonExpiredBatches.reduce((acc, b) => acc + (b.current_stock || 0), 0);
        const totalStock = (medJson.batches || []).reduce((acc, b) => acc + (b.current_stock || 0), 0);
        const threshold = medJson.low_stock_threshold !== undefined
            ? medJson.low_stock_threshold
            : (medJson.min_stock_threshold !== undefined ? medJson.min_stock_threshold : 10);

        medJson.total_stock = totalStock;
        medJson.sellableQty = sellableStock;
        medJson.sellable_stock = sellableStock;
        medJson.expired = (medJson.batches || []).some((b) => new Date(b.expiry_date) < today);

        if (sellableStock === 0) {
            medJson.is_out_of_stock = true;
            outOfStockList.push(medJson);
        }

        // Low stock rule: sellable quantity below threshold
        if (sellableStock <= threshold) {
            medJson.is_low_stock = true;
            if ((!medJson.mrp || medJson.mrp === 0) && medJson.batches && medJson.batches.length > 0) {
                medJson.mrp = medJson.batches[0].mrp || 0;
            }
            if ((!medJson.sale_price || medJson.sale_price === 0) && medJson.batches && medJson.batches.length > 0) {
                medJson.sale_price = medJson.batches[0].sale_price || medJson.mrp || 0;
            }
            lowStockList.push(medJson);
        }
    }

    // Expiring soon: batches expiring within configured window (not yet expired: expiry >= today)
    const expiringBatches = await MedicineBatch.find({
        branch_id: branchObjectId,
        is_active: true,
        current_stock: { $gt: 0 },
        expiry_date: { $lte: targetDate, $gte: today },
    })
        .populate('medicine', 'name generic_name manufacturer sku_barcode')
        .sort({ expiry_date: 1 });

    const formattedExpiringBatches = expiringBatches.map((b) => {
        const bJson = b.toJSON();
        bJson.expired = false;
        bJson.is_expired = false;
        return bJson;
    });

    // Expired batches: counted only in expiredCount (expiry < today)
    const expiredBatches = await MedicineBatch.find({
        branch_id: branchObjectId,
        is_active: true,
        current_stock: { $gt: 0 },
        expiry_date: { $lt: today },
    })
        .populate('medicine', 'name generic_name manufacturer sku_barcode')
        .sort({ expiry_date: 1 });

    const formattedExpiredBatches = expiredBatches.map((b) => {
        const bJson = b.toJSON();
        bJson.expired = true;
        bJson.is_expired = true;
        return bJson;
    });

    const lowStockCount = lowStockList.length;
    const outOfStockCount = outOfStockList.length;
    const expiringSoonCount = formattedExpiringBatches.length;
    const expiredCount = formattedExpiredBatches.length;

    return {
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        expiredCount,
        // Backward compatible aliases
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        expiring_soon_count: expiringSoonCount,
        expired_count: expiredCount,
        expiringBatchesCount: expiringSoonCount,
        expiring_batches_count: expiringSoonCount,
        expiredBatchesCount: expiredCount,
        expired_batches_count: expiredCount,
        // Lists
        lowStockMedicines: lowStockList,
        outOfStockMedicines: outOfStockList,
        expiringBatches: formattedExpiringBatches,
        expiredBatches: formattedExpiredBatches,
    };
};

const getInventoryAlertCounts = async (branchId, days = 60) => {
    return getStockCounts(branchId, days);
};

const getLowStockMedicines = async (branchId) => {
    const data = await getStockCounts(branchId);
    return data.lowStockMedicines;
};

const getExpiringBatches = async (branchId, days = 60) => {
    const data = await getStockCounts(branchId, days);
    return data.expiringBatches;
};

const getExpiredBatches = async (branchId) => {
    const data = await getStockCounts(branchId);
    return data.expiredBatches;
};

const createMedicineWithBatch = async (branchId, userId, payload, file) => {
    const {
        category_id,
        name,
        generic_name,
        sku_barcode,
        sku,
        manufacturer,
        hsn_code,
        form,
        unit,
        unit_quantity,
        is_prescription_required,
        low_stock_threshold,
        side_effects,
        storage_instructions,
        batch_number,
        batchNumber,
        mfg_date,
        mfgDate,
        expiry_date,
        expiryDate,
        purchase_rate,
        purchaseRate,
        purchasePrice,
        mrp,
        sale_price,
        salePrice,
        sellingPrice,
        gst_rate,
        gstRate,
        initial_stock,
        initialStock,
        quantity,
        rack_location,
        rackLocation,
    } = payload;

    const effectiveSku = (sku_barcode || sku || '').trim();
    const effectiveBatchNumber = (batch_number || batchNumber || '').trim();
    const effectiveExpiryDate = expiry_date || expiryDate;
    const effectiveMfgDate = mfg_date || mfgDate || null;
    const parsedPurchaseRate = parseFloat(purchase_rate || purchaseRate || purchasePrice || 0);
    const parsedMrp = parseFloat(mrp || 0);
    const parsedSalePrice = parseFloat(sale_price || salePrice || sellingPrice || parsedMrp || 0);
    const parsedGstRate = parseFloat(gst_rate || gstRate || 0);
    const parsedInitialStock = parseInt(initial_stock !== undefined ? initial_stock : (initialStock !== undefined ? initialStock : (quantity || 0)));
    const effectiveRack = (rack_location || rackLocation || '').trim();

    if (!name || name.trim() === '') {
        throw new ApiError(400, 'Medicine name is required', 'NAME_REQUIRED');
    }
    if (!effectiveBatchNumber) {
        throw new ApiError(400, 'Batch number is required', 'BATCH_NUMBER_REQUIRED');
    }
    if (!effectiveExpiryDate) {
        throw new ApiError(400, 'Expiry date is required', 'EXPIRY_DATE_REQUIRED');
    }

    const expDate = new Date(effectiveExpiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(expDate.getTime()) || expDate <= today) {
        throw new ApiError(400, 'Batch expiry date must be in the future', 'INVALID_EXPIRY_DATE');
    }
    if (parsedPurchaseRate < 0 || parsedMrp < 0 || parsedSalePrice < 0) {
        throw new ApiError(400, 'Price values cannot be negative', 'INVALID_PRICE');
    }
    if (parsedMrp < parsedPurchaseRate) {
        throw new ApiError(400, 'MRP cannot be less than purchase price', 'INVALID_MRP');
    }
    if (parsedInitialStock < 0) {
        throw new ApiError(400, 'Initial stock cannot be negative', 'INVALID_STOCK');
    }

    const imageUrl = file ? `/uploads/medicines/${file.filename}` : null;

    let effectiveCategoryId = category_id;
    if (!effectiveCategoryId) {
        let defaultCat = await Category.findOne({ branch_id: branchId, is_active: true });
        if (!defaultCat) {
            defaultCat = await Category.create({
                branch_id: branchId,
                name: 'General',
                description: 'Default category',
            });
        }
        effectiveCategoryId = defaultCat._id;
    }

    let session = null;
    let useSession = true;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (e) {
        useSession = false;
    }

    let createdMedicine = null;
    let createdBatch = null;
    let createdStockLog = null;

    try {
        const medicineDoc = {
            branch_id: branchId,
            category_id: effectiveCategoryId,
            name: name.trim(),
            generic_name: generic_name ? generic_name.trim() : '',
            sku_barcode: effectiveSku,
            manufacturer: manufacturer ? manufacturer.trim() : '',
            hsn_code: hsn_code || '',
            form: form || 'Tablet',
            unit: unit || 'Strip',
            unit_quantity: unit_quantity ? parseInt(unit_quantity) : 10,
            is_prescription_required: is_prescription_required === true || is_prescription_required === 'true',
            low_stock_threshold: low_stock_threshold ? parseInt(low_stock_threshold) : 10,
            side_effects,
            storage_instructions,
            image_url: imageUrl,
            mrp: parsedMrp,
            sale_price: parsedSalePrice,
            purchase_rate: parsedPurchaseRate,
            gst_rate: parsedGstRate,
        };

        if (useSession && session) {
            try {
                const [med] = await Medicine.create([medicineDoc], { session });
                createdMedicine = med;

                const batchDoc = {
                    branch_id: branchId,
                    medicine_id: createdMedicine._id,
                    batch_number: effectiveBatchNumber,
                    mfg_date: effectiveMfgDate ? new Date(effectiveMfgDate) : null,
                    expiry_date: expDate,
                    purchase_rate: parsedPurchaseRate,
                    mrp: parsedMrp,
                    sale_price: parsedSalePrice,
                    gst_rate: parsedGstRate,
                    current_stock: parsedInitialStock,
                    rack_location: effectiveRack,
                };

                const [b] = await MedicineBatch.create([batchDoc], { session });
                createdBatch = b;

                if (parsedInitialStock > 0) {
                    const [log] = await StockLog.create(
                        [
                            {
                                branch_id: branchId,
                                medicine_id: createdMedicine._id,
                                batch_id: createdBatch._id,
                                type: STOCK_TRANSACTION_TYPES?.PURCHASE_IN || STOCK_LOG_TYPES.PURCHASE_IN,
                                quantity: parsedInitialStock,
                                balance_after: parsedInitialStock,
                                unit_cost: parsedPurchaseRate,
                                remarks: 'Initial Batch Stocking (Atomic Creation)',
                                created_by_user_id: userId,
                            },
                        ],
                        { session }
                    );
                    createdStockLog = log;
                }

                await session.commitTransaction();
                try { session.endSession(); } catch (_) {}
            } catch (txErr) {
                try {
                    if (session && session.inTransaction()) {
                        await session.abortTransaction();
                    }
                } catch (_) {}
                try { session.endSession(); } catch (_) {}
                useSession = false;
            }
        }

        if (!useSession) {
            createdMedicine = await Medicine.create(medicineDoc);
            try {
                createdBatch = await MedicineBatch.create({
                    branch_id: branchId,
                    medicine_id: createdMedicine._id,
                    batch_number: effectiveBatchNumber,
                    mfg_date: effectiveMfgDate ? new Date(effectiveMfgDate) : null,
                    expiry_date: expDate,
                    purchase_rate: parsedPurchaseRate,
                    mrp: parsedMrp,
                    sale_price: parsedSalePrice,
                    gst_rate: parsedGstRate,
                    current_stock: parsedInitialStock,
                    rack_location: effectiveRack,
                });

                if (parsedInitialStock > 0) {
                    createdStockLog = await StockLog.create({
                        branch_id: branchId,
                        medicine_id: createdMedicine._id,
                        batch_id: createdBatch._id,
                        type: STOCK_TRANSACTION_TYPES?.PURCHASE_IN || STOCK_LOG_TYPES.PURCHASE_IN,
                        quantity: parsedInitialStock,
                        balance_after: parsedInitialStock,
                        unit_cost: parsedPurchaseRate,
                        remarks: 'Initial Batch Stocking (Atomic Creation)',
                        created_by_user_id: userId,
                    });
                }
            } catch (err) {
                if (createdMedicine) {
                    await Medicine.findByIdAndDelete(createdMedicine._id);
                }
                throw err;
            }
        }

        const medJson = createdMedicine.toJSON();
        medJson.batches = [createdBatch.toJSON()];
        medJson.total_stock = parsedInitialStock;
        medJson.sellableQty = parsedInitialStock;
        medJson.sellable_stock = parsedInitialStock;
        medJson.expired = false;
        medJson.is_expired = false;
        medJson.is_low_stock = parsedInitialStock <= (createdMedicine.low_stock_threshold || 10);

        return {
            medicine: medJson,
            batch: createdBatch.toJSON(),
            stock_log: createdStockLog,
        };
    } catch (err) {
        if (session) {
            try {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
            } catch (_) {}
            try {
                session.endSession();
            } catch (_) {}
        }
        throw err;
    }
};

const getMedicineBatches = async (branchId, medicineId) => {
    return await MedicineBatch.find({
        medicine_id: medicineId,
        branch_id: branchId,
        is_active: true,
    }).sort({ expiry_date: 1 });
};

module.exports = {
    createCategory,
    getCategories,
    createMedicine,
    updateMedicine,
    getMedicines,
    getMedicineById,
    createBatch,
    createMedicineWithBatch,
    adjustStock,
    processReturn,
    lookupByBarcode,
    getStockCounts,
    getInventoryAlertCounts,
    getLowStockMedicines,
    getExpiringBatches,
    getExpiredBatches,
    getMedicineBatches,
};
