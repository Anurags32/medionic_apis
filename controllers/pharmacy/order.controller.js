const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const orderService = require('../../services/pharmacy/order.service');


const createOrder = asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.user.branchId, req.user.userId, req.body);
    res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
});

const acceptOrder = asyncHandler(async (req, res) => {
    const order = await orderService.acceptOrder(req.user.branchId, req.user.userId, req.params.id);
    res.status(200).json(new ApiResponse(200, order, 'Order accepted and invoice generated successfully'));
});

const getOrders = asyncHandler(async (req, res) => {
    const result = await orderService.getOrders(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Orders fetched successfully'));
});

const getOrderById = asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, order, 'Order details fetched successfully'));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status, remarks } = req.body;
    const order = await orderService.updateOrderStatus(req.user.branchId, req.params.id, status, remarks);
    res.status(200).json(new ApiResponse(200, order, 'Order status updated successfully'));
});

const assignPacker = asyncHandler(async (req, res) => {
    const packer_id = req.body.packer_id || req.body.delivery_agent_id;
    const order = await orderService.assignPacker(req.user.branchId, req.params.id, packer_id);
    res.status(200).json(new ApiResponse(200, order, 'Packer assigned to order successfully'));
});

const assignDeliveryAgent = asyncHandler(async (req, res) => {
    const delivery_agent_id = req.body.delivery_agent_id || req.body.packer_id;
    const order = await orderService.assignDeliveryAgent(req.user.branchId, req.params.id, delivery_agent_id);
    res.status(200).json(new ApiResponse(200, order, 'Delivery agent assigned successfully'));
});

module.exports = {
    createOrder,
    acceptOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    assignPacker,
    assignDeliveryAgent,
};
