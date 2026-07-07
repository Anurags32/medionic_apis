const MedicalRep = require('../models/MedicalRep');
const Doctor = require('../models/Doctor');
const Chemist = require('../models/Chemist');
const Expense = require('../models/Expense');
const TourPlan = require('../models/TourPlan');
const DCR = require('../models/DCR');
const ErrorResponse = require('../utils/errorResponse');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');

// ============= TOUR PLANNING =============

// @desc    Get monthly tour plan
// @route   GET /api/mr/tour-plan
// @access  Private/MR
exports.getTourPlan = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const { month, year } = req.query;

        const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();

        const tourPlan = await TourPlan.findOne({
            mrId,
            month: currentMonth,
            year: currentYear
        });

        if (!tourPlan) {
            return res.status(200).json({
                success: true,
                message: 'No tour plan found for the specified period',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            data: tourPlan
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create/Update tour plan
// @route   POST /api/mr/tour-plan
// @access  Private/MR
exports.createTourPlan = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const { month, year, routes } = req.body;

        if (!month || !year || !routes || !Array.isArray(routes) || routes.length === 0) {
            return next(new ErrorResponse('Month, year, and routes list are required', 400));
        }

        // Check if plan already exists
        let tourPlan = await TourPlan.findOne({ mrId, month, year });

        if (tourPlan) {
            tourPlan.routes = routes;
            await tourPlan.save();
        } else {
            tourPlan = await TourPlan.create({
                mrId,
                month,
                year,
                routes
            });
        }

        res.status(201).json({
            success: true,
            message: 'Tour plan saved successfully',
            data: tourPlan
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get weekly breakdown
// @route   GET /api/mr/tour-plan/:id/weekly
// @access  Private/MR
exports.getWeeklyBreakdown = async (req, res, next) => {
    try {
        const { id } = req.params;
        const mrId = req.user._id;

        const tourPlan = await TourPlan.findOne({ _id: id, mrId });
        if (!tourPlan) {
            return next(new ErrorResponse('Tour plan not found', 404));
        }

        // Divide routes into weeks of 7 days
        const weeks = [];
        let currentWeek = [];
        let weekNumber = 1;

        const sortedRoutes = [...tourPlan.routes].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedRoutes.forEach((route, index) => {
            currentWeek.push(route);
            if (currentWeek.length === 7 || index === sortedRoutes.length - 1) {
                weeks.push({
                    week: `Week ${weekNumber}`,
                    routes: currentWeek
                });
                currentWeek = [];
                weekNumber++;
            }
        });

        res.status(200).json({
            success: true,
            data: weeks
        });
    } catch (error) {
        next(error);
    }
};

// ============= CHEMIST MANAGEMENT =============

// @desc    Add chemist
// @route   POST /api/mr/chemists
// @access  Private/MR
exports.addChemist = async (req, res, next) => {
    try {
        const { chemistName, contactPerson, phone, address, city } = req.body;
        const mrId = req.user._id;

        const chemist = await Chemist.create({
            mrId,
            chemistName,
            contactPerson,
            phone,
            address,
            city
        });

        res.status(201).json({
            success: true,
            message: 'Chemist added successfully',
            data: chemist
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all chemists
// @route   GET /api/mr/chemists
// @access  Private/MR
exports.getChemists = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const chemists = await Chemist.find({ mrId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: chemists
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update chemist
// @route   PUT /api/mr/chemists/:id
// @access  Private/MR
exports.updateChemist = async (req, res, next) => {
    try {
        const { id } = req.params;
        const mrId = req.user._id;

        const chemist = await Chemist.findOneAndUpdate(
            { _id: id, mrId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!chemist) {
            return next(new ErrorResponse('Chemist not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Chemist updated successfully',
            data: chemist
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete chemist
// @route   DELETE /api/mr/chemists/:id
// @access  Private/MR
exports.deleteChemist = async (req, res, next) => {
    try {
        const { id } = req.params;
        const mrId = req.user._id;

        const chemist = await Chemist.findOneAndDelete({ _id: id, mrId });
        if (!chemist) {
            return next(new ErrorResponse('Chemist not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Chemist deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// ============= EXPENSE MANAGEMENT =============

// @desc    Log expense
// @route   POST /api/mr/expenses
// @access  Private/MR
exports.logExpense = async (req, res, next) => {
    try {
        const { amount, expenseType, date, description } = req.body;
        const mrId = req.user._id;

        const expense = await Expense.create({
            mrId,
            amount,
            expenseType,
            date: date || new Date(),
            description
        });

        res.status(201).json({
            success: true,
            message: 'Expense logged successfully',
            data: expense
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get expenses
// @route   GET /api/mr/expenses
// @access  Private/MR
exports.getExpenses = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const { expenseType, approvalStatus } = req.query;
        const query = { mrId };

        if (expenseType) query.expenseType = expenseType;
        if (approvalStatus) query.approvalStatus = approvalStatus;

        const expenses = await Expense.find(query).sort({ date: -1 });

        res.status(200).json({
            success: true,
            data: expenses
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get pending approvals
// @route   GET /api/mr/expenses/pending-approvals
// @access  Private/MR
exports.getPendingApprovals = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const expenses = await Expense.find({ mrId, approvalStatus: 'pending' }).sort({ date: 1 });

        res.status(200).json({
            success: true,
            data: expenses
        });
    } catch (error) {
        next(error);
    }
};

// ============= DAILY CALL REPORT (DCR) =============

// @desc    Submit DCR
// @route   POST /api/mr/dcr
// @access  Private/MR
exports.submitDCR = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const { doctorId, visitDate, discussionPoints, samplesDistributed } = req.body;

        if (!doctorId || !visitDate || !discussionPoints) {
            return next(new ErrorResponse('Doctor ID, visit date, and discussion points are required', 400));
        }

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        // Deduct distributed samples from MR's inventory
        if (samplesDistributed && Array.isArray(samplesDistributed)) {
            for (const sample of samplesDistributed) {
                const item = mr.sampleInventory.find(s => s.productName.toLowerCase() === sample.sampleName.toLowerCase());
                if (!item) {
                    return next(new ErrorResponse(`Sample '${sample.sampleName}' not found in inventory`, 404));
                }
                if (item.quantity < sample.quantity) {
                    return next(new ErrorResponse(`Insufficient stock for '${sample.sampleName}'. Available: ${item.quantity}`, 400));
                }
                item.quantity -= sample.quantity;
            }
            mr.markModified('sampleInventory');
            await mr.save();
        }

        const dcr = await DCR.create({
            mrId,
            doctorId,
            visitDate,
            discussionPoints,
            samplesDistributed: samplesDistributed || []
        });

        res.status(201).json({
            success: true,
            message: 'DCR submitted successfully',
            data: dcr
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get DCR list
// @route   GET /api/mr/dcr
// @access  Private/MR
exports.getDCRList = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const dcrs = await DCR.find({ mrId })
            .populate('doctorId', 'firstName lastName specialization clinic')
            .sort({ visitDate: -1 });

        res.status(200).json({
            success: true,
            data: dcrs
        });
    } catch (error) {
        next(error);
    }
};
