const MedicalRep = require('../models/MedicalRep');
const Doctor = require('../models/Doctor');
const ErrorResponse = require('../utils/errorResponse');
const constants = require('../config/constants');

// ============= TOUR PLANNING =============

// @desc    Get monthly tour plan
// @route   GET /api/mr/tour-plan
// @access  Private/MR
exports.getTourPlan = async (req, res, next) => {
    try {
        const mrId = req.user._id;
        const { month, year } = req.query;

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const tourPlan = mr.tourPlans?.find(tp => {
            if (month && year) {
                return tp.month === parseInt(month) && tp.year === parseInt(year);
            }
            return tp.month === new Date().getMonth() + 1 && tp.year === new Date().getFullYear();
        });

        if (!tourPlan) {
            return res.status(200).json({
                success: true,
                message: 'No tour plan found',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            message: 'Tour plan retrieved',
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
        const { month, year, doctorsToVisit, productsFocus, budget, notes } = req.body;

        if (!month || !year || !doctorsToVisit || doctorsToVisit.length === 0) {
            return next(new ErrorResponse('Month, year, and doctors to visit are required', 400));
        }

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const tourPlan = {
            _id: new require('mongoose').Types.ObjectId(),
            month: parseInt(month),
            year: parseInt(year),
            doctorsToVisit,
            productsFocus: productsFocus || [],
            budget: budget || 0,
            notes,
            weeklyBreakdown: generateWeeklyBreakdown(doctorsToVisit, month, year),
            createdAt: new Date(),
            status: 'draft'
        };

        if (!mr.tourPlans) {
            mr.tourPlans = [];
        }

        // Remove existing plan for same month/year
        mr.tourPlans = mr.tourPlans.filter(tp => !(tp.month === month && tp.year === year));
        mr.tourPlans.push(tourPlan);

        await mr.save();

        res.status(201).json({
            success: true,
            message: 'Tour plan created successfully',
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

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const tourPlan = mr.tourPlans?.find(tp => tp._id.toString() === id);
        if (!tourPlan) {
            return next(new ErrorResponse('Tour plan not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Weekly breakdown retrieved',
            data: tourPlan.weeklyBreakdown
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
        const { name, location, pharmacyName, contact, prescriptionTrend } = req.body;
        const mrId = req.user._id;

        if (!name || !pharmacyName || !contact) {
            return next(new ErrorResponse('Name, pharmacy name, and contact are required', 400));
        }

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        if (!mr.chemists) {
            mr.chemists = [];
        }

        const chemist = {
            _id: new require('mongoose').Types.ObjectId(),
            name,
            location,
            pharmacyName,
            contact,
            prescriptionTrend: prescriptionTrend || 'increasing',
            lastVisit: null,
            addedAt: new Date()
        };

        mr.chemists.push(chemist);
        await mr.save();

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
        const { limit = 20, skip = 0 } = req.query;

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const chemists = mr.chemists || [];
        const total = chemists.length;

        const paginatedChemists = chemists
            .sort((a, b) => b.addedAt - a.addedAt)
            .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Chemists retrieved',
            data: {
                total,
                count: paginatedChemists.length,
                chemists: paginatedChemists
            }
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
        const { name, location, pharmacyName, contact, prescriptionTrend } = req.body;

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const chemist = mr.chemists?.find(c => c._id.toString() === id);
        if (!chemist) {
            return next(new ErrorResponse('Chemist not found', 404));
        }

        if (name) chemist.name = name;
        if (location) chemist.location = location;
        if (pharmacyName) chemist.pharmacyName = pharmacyName;
        if (contact) chemist.contact = contact;
        if (prescriptionTrend) chemist.prescriptionTrend = prescriptionTrend;

        await mr.save();

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

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const chemistIndex = mr.chemists?.findIndex(c => c._id.toString() === id);
        if (chemistIndex === -1 || chemistIndex === undefined) {
            return next(new ErrorResponse('Chemist not found', 404));
        }

        mr.chemists.splice(chemistIndex, 1);
        await mr.save();

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
        const { type, amount, category, date, description, receipt } = req.body;
        const mrId = req.user._id;

        if (!type || !amount || !category) {
            return next(new ErrorResponse('Type, amount, and category are required', 400));
        }

        if (!['travel', 'meal', 'accommodation', 'misc'].includes(type)) {
            return next(new ErrorResponse('Invalid expense type', 400));
        }

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        if (!mr.expenses) {
            mr.expenses = [];
        }

        const expense = {
            _id: new require('mongoose').Types.ObjectId(),
            type,
            amount,
            category,
            date: date || new Date(),
            description,
            receipt: receipt || null,
            status: 'submitted',
            submittedAt: new Date(),
            approvedAt: null,
            approvedBy: null
        };

        mr.expenses.push(expense);
        await mr.save();

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
        const { type, status = 'submitted', month, year, limit = 20, skip = 0 } = req.query;

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        let expenses = mr.expenses || [];

        // Filter by type
        if (type) {
            expenses = expenses.filter(e => e.type === type);
        }

        // Filter by status
        if (status) {
            expenses = expenses.filter(e => e.status === status);
        }

        // Filter by month/year
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            expenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
        }

        const total = expenses.length;
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

        const paginatedExpenses = expenses
            .sort((a, b) => b.date - a.date)
            .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Expenses retrieved',
            data: {
                total,
                count: paginatedExpenses.length,
                totalAmount,
                expenses: paginatedExpenses
            }
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

        const mr = await MedicalRep.findOne({ userId: mrId });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const pending = (mr.expenses || []).filter(e => e.status === 'submitted');
        const totalPending = pending.reduce((sum, e) => sum + e.amount, 0);

        res.status(200).json({
            success: true,
            message: 'Pending approvals retrieved',
            data: {
                count: pending.length,
                totalAmount: totalPending,
                expenses: pending
            }
        });
    } catch (error) {
        next(error);
    }
};

// ============= HELPER FUNCTIONS =============

function generateWeeklyBreakdown(doctorsToVisit, month, year) {
    const weeks = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    let weekStart = new Date(firstDay);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    while (weekStart <= lastDay) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const week = {
            week: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
            doctorsScheduled: doctorsToVisit.slice(weeks.length * 3, (weeks.length + 1) * 3),
            targets: {
                doctors: 3,
                products: 5
            }
        };

        weeks.push(week);
        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
    }

    return weeks;
}
