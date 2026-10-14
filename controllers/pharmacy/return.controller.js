const asyncHandler = require('../../utils/asyncHandler');
const returnService = require('../../services/pharmacy/return.service');

/**
 * GET /returns - Get paginated list of returns
 */
const getReturns = asyncHandler(async (req, res) => {
    const result = await returnService.getReturns(req.user.branchId, req.query);
    res.status(200).json({
        success: true,
        data: result,
    });
});

/**
 * GET /returns/:id - Get single return details
 */
const getReturnById = asyncHandler(async (req, res) => {
    const result = await returnService.getReturnById(req.user.branchId, req.params.id);
    res.status(200).json({
        success: true,
        data: result,
    });
});

/**
 * POST /returns - Create a new return
 */
const createReturn = asyncHandler(async (req, res) => {
    const result = await returnService.createReturn(req.user.branchId, req.user.userId, req.body);
    res.status(201).json({
        success: true,
        message: 'Return created successfully',
        data: result,
    });
});

/**
 * POST /returns/:id/inspect - Inspect a return
 */
const inspectReturn = asyncHandler(async (req, res) => {
    const result = await returnService.inspectReturn(
        req.user.branchId,
        req.user.userId,
        req.params.id,
        req.body
    );
    res.status(200).json({
        success: true,
        message: 'Return inspected successfully',
        data: result,
    });
});

/**
 * POST /returns/:id/restock - Restock returned item(s) into inventory
 */
const restockReturn = asyncHandler(async (req, res) => {
    const result = await returnService.restockReturn(
        req.user.branchId,
        req.user.userId,
        req.params.id,
        req.body
    );
    res.status(200).json({
        success: true,
        message: 'Return items restocked into inventory',
        data: result,
    });
});

/**
 * POST /returns/:id/dispose - Dispose returned item(s)
 */
const disposeReturn = asyncHandler(async (req, res) => {
    const result = await returnService.disposeReturn(
        req.user.branchId,
        req.user.userId,
        req.params.id,
        req.body
    );
    res.status(200).json({
        success: true,
        message: 'Return items recorded as disposed',
        data: result,
    });
});

module.exports = {
    getReturns,
    getReturnById,
    createReturn,
    inspectReturn,
    restockReturn,
    disposeReturn,
};
