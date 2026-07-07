const express = require('express');
const router = express.Router();

const {
    getProducts,
    getProduct,
    createOrder,
    getMyOrders,
    getOrder
} = require('../controllers/pharmacyController');

const { protect, authorize } = require('../middleware/auth');
const upload = require('../services/uploadService');
const constants = require('../config/constants');

// Product catalog — any authenticated user can browse
router.use(protect);

router.get('/products', getProducts);
router.get('/products/:id', getProduct);

// Orders — patients only
router.route('/orders')
    .get(authorize(constants.ROLES.PATIENT), getMyOrders)
    .post(
        authorize(constants.ROLES.PATIENT),
        upload.single('prescriptionFile'),
        createOrder
    );

router.get('/orders/:id', authorize(constants.ROLES.PATIENT), getOrder);

module.exports = router;
