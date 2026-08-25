const PharmacyProduct = require('../models/PharmacyProduct');
const PharmacyOrder = require('../models/PharmacyOrder');
const Patient = require('../models/Patient');
const ErrorResponse = require('../utils/errorResponse');
const helpers = require('../utils/helpers');


exports.getProducts = async (req, res, next) => {
    try {
        const { search, category, page = 1, limit = 20 } = req.query;
        const query = {};

        if (category && category.trim()) {
            query.category = { $regex: category.trim(), $options: 'i' };
        }

        if (search && search.trim()) {
            query.$text = { $search: search.trim() };
        }

        if (req.query.inStock !== 'all') {
            query.inStock = true;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const sortObj = search && search.trim()
            ? { score: { $meta: 'textScore' } }
            : { name: 1 };

        const [products, total] = await Promise.all([
            PharmacyProduct.find(query, search && search.trim() ? { score: { $meta: 'textScore' } } : {})
                .sort(sortObj)
                .skip(skip)
                .limit(parseInt(limit)),
            PharmacyProduct.countDocuments(query)
        ]);

        const categories = await PharmacyProduct.distinct('category');

        res.status(200).json({
            success: true,
            data: products,
            categories,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};


exports.getProduct = async (req, res, next) => {
    try {
        const product = await PharmacyProduct.findById(req.params.id);
        if (!product) {
            return next(new ErrorResponse('Product not found', 404));
        }
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

exports.createOrder = async (req, res, next) => {
    try {

        let items = req.body.items;
        if (typeof items === 'string') {
            try {
                items = JSON.parse(items);
            } catch {
                return next(new ErrorResponse('items must be a valid JSON array', 400));
            }
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return next(new ErrorResponse('Please provide at least one item', 400));
        }

        const { shippingAddress, paymentMethod = 'COD' } = req.body;

        if (!shippingAddress) {
            return next(new ErrorResponse('Shipping address is required', 400));
        }

        let addressObj;
        if (typeof shippingAddress === 'string') {
            try {
                addressObj = JSON.parse(shippingAddress);
            } catch {
                const parts = shippingAddress.split(',').map(s => s.trim());
                addressObj = {
                    street: parts[0] || shippingAddress,
                    city: parts[1] || 'Unknown',
                    state: parts[2] || 'Unknown',
                    zip: parts[3] || '000000',
                    contactPhone: req.body.contactPhone || '0000000000'
                };
            }
        } else {
            addressObj = shippingAddress;
        }

        if (!addressObj.contactPhone) {
            addressObj.contactPhone = req.body.contactPhone || '0000000000';
        }

        const productIds = items.map(i => i.productId);
        const products = await PharmacyProduct.find({ _id: { $in: productIds } });

        if (products.length !== productIds.length) {
            return next(new ErrorResponse('One or more product IDs are invalid', 400));
        }

        const outOfStock = products.filter(p => !p.inStock);
        if (outOfStock.length > 0) {
            return next(new ErrorResponse(
                `The following products are out of stock: ${outOfStock.map(p => p.name).join(', ')}`,
                400
            ));
        }


        const requiresRx = products.some(p => p.requiresPrescription);
        const prescriptionFileUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (requiresRx && !prescriptionFileUrl) {
            return next(new ErrorResponse(
                'One or more items require a valid prescription. Please upload your prescription.',
                400
            ));
        }
        const productMap = {};
        products.forEach(p => { productMap[p._id.toString()] = p; });

        const medicines = items.map(item => {
            const prod = productMap[item.productId.toString()];
            return {
                medicineName: prod.name,
                genericName: prod.brand,
                quantity: item.quantity || 1,
                price: prod.price,
                manufacturer: prod.brand
            };
        });

        const totalAmount = medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);

        const patient = await Patient.findOne({ userId: req.user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const order = await PharmacyOrder.create({
            patientId: patient._id,
            medicines,
            totalAmount,
            discountApplied: 0,
            taxAmount: 0,
            finalAmount: totalAmount,
            paymentMethod,
            paymentStatus: 'pending',
            deliveryAddress: addressObj,
            status: 'pending',
            prescriptionRequired: requiresRx,
            prescriptionVerified: false,
            ...(prescriptionFileUrl && { orderNotes: `Prescription: ${prescriptionFileUrl}` })
        });

        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

exports.getMyOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const patient = await Patient.findOne({ userId: req.user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const query = { patientId: patient._id };
        if (status) query.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [orders, total] = await Promise.all([
            PharmacyOrder.find(query)
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 }),
            PharmacyOrder.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: orders,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.getOrder = async (req, res, next) => {
    try {
        const patient = await Patient.findOne({ userId: req.user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const order = await PharmacyOrder.findById(req.params.id);
        if (!order) {
            return next(new ErrorResponse('Order not found', 404));
        }

        if (order.patientId.toString() !== patient._id.toString()) {
            return next(new ErrorResponse('Not authorized to view this order', 403));
        }

        res.status(200).json({ success: true, data: order });
    } catch (error) {
        next(error);
    }
};
