const MedicalRep = require('../models/MedicalRep');
const Doctor = require('../models/Doctor');
const MRMeetings = require('../models/MRMeetings');
const ErrorResponse = require('../utils/errorResponse');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');


exports.getProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                firstName: mr.firstName || user.firstName,
                lastName: mr.lastName || user.lastName,
                email: user.email,
                phone: user.phone,
                companyName: mr.companyName,
                employeeId: mr.employmentDetails ? mr.employmentDetails.employeeId : mr.employeeId,
                designation: mr.designation,
                territory: mr.territory,
                verificationStatus: mr.verificationStatus,
                profilePhoto: user.profilePhoto || mr.profilePicture
            }
        });
    } catch (error) {
        next(error);
    }
};


exports.updateProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        let userUpdated = false;
        if (req.body.profilePhoto !== undefined) {
            user.profilePhoto = req.body.profilePhoto;
            mr.profilePicture = req.body.profilePhoto;
            userUpdated = true;
        }
        if (userUpdated) {
            await user.save();
        }

        if (req.body.designation !== undefined) {
            mr.designation = req.body.designation;
        }
        if (req.body.territory !== undefined) {
            mr.territory = req.body.territory;
        }

        await mr.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                firstName: mr.firstName || user.firstName,
                lastName: mr.lastName || user.lastName,
                email: user.email,
                phone: user.phone,
                companyName: mr.companyName,
                employeeId: mr.employmentDetails ? mr.employmentDetails.employeeId : mr.employeeId,
                designation: mr.designation,
                territory: mr.territory,
                verificationStatus: mr.verificationStatus,
                profilePhoto: user.profilePhoto || mr.profilePicture
            }
        });
    } catch (error) {
        next(error);
    }
};


exports.getDoctors = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            specialization,
            hospital,
            performance,
            page = 1,
            limit = 10,
            search
        } = req.query;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const query = {
            'clinic.city': { $regex: mr.territory, $options: 'i' },
            verificationStatus: constants.VERIFICATION_STATUS.VERIFIED
        };

        if (specialization) {
            query.specialization = { $regex: specialization, $options: 'i' };
        }

        if (hospital) {
            query['clinic.name'] = { $regex: hospital, $options: 'i' };
        }

        if (performance) {
            const ratingMap = { A: 4.5, B: 3.5, C: 2.5 };
            if (ratingMap[performance]) {
                query.rating = { $gte: ratingMap[performance] };
            }
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { specialization: searchRegex },
                { 'clinic.name': searchRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const doctors = await Doctor.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ rating: -1, firstName: 1 });

        const total = await Doctor.countDocuments(query);

        const doctorsWithHistory = await Promise.all(
            doctors.map(async (doctor) => {
                const lastMeeting = await MRMeetings.findOne({
                    mrId: mr._id,
                    doctorId: doctor._id,
                    status: constants.MEETING_STATUS.COMPLETED
                }).sort({ completedAt: -1 });

                const meetingCount = await MRMeetings.countDocuments({
                    mrId: mr._id,
                    doctorId: doctor._id,
                    status: constants.MEETING_STATUS.COMPLETED
                });

                const prescriptionValue = Math.floor(Math.random() * 50000) + 10000; // Mock data
                const rating = doctor.rating >= 4.5 ? 'A' : doctor.rating >= 3.5 ? 'B' : 'C';

                return {
                    doctorId: doctor._id,
                    name: doctor.fullName,
                    specialization: doctor.specialization,
                    clinic: doctor.clinic,
                    rating: doctor.rating,
                    performance: rating,
                    prescriptionValue,
                    lastVisit: lastMeeting?.formattedMeetingDate || 'Never',
                    meetingCount,
                    nextFollowUp: lastMeeting?.nextFollowUp?.date || null
                };
            })
        );

        res.status(200).json({
            success: true,
            data: doctorsWithHistory,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.getDoctorDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const doctor = await Doctor.findById(id);

        if (!doctor) {
            return next(new ErrorResponse('Doctor not found', 404));
        }

        const meetings = await MRMeetings.find({
            mrId: mr._id,
            doctorId: doctor._id
        }).sort({ createdAt: -1 }).limit(10);

        const lastMeeting = meetings.find(m => m.status === constants.MEETING_STATUS.COMPLETED);

        res.status(200).json({
            success: true,
            data: {
                doctor: {
                    ...doctor.toObject(),
                    experience: doctor.experience
                },
                meetingHistory: meetings.map(meeting => ({
                    meetingId: meeting._id,
                    date: meeting.formattedMeetingDate || meeting.formattedProposedDate,
                    status: meeting.status,
                    purpose: meeting.purpose,
                    products: meeting.products,
                    samplesProvided: meeting.samplesProvided,
                    notes: meeting.notes
                })),
                lastVisit: lastMeeting?.formattedMeetingDate || 'Never',
                nextFollowUp: lastMeeting?.nextFollowUp?.date || null,
                productsDiscussed: lastMeeting?.products || [],
                totalMeetings: meetings.length
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.requestMeeting = [
    validate('requestMeeting'),
    async (req, res, next) => {
        try {
            const user = req.user;
            const {
                doctorId,
                proposedDate,
                proposedTime,
                purpose,
                products = [],
                message
            } = req.body;

            const mr = await MedicalRep.findOne({ userId: user._id });

            if (!mr) {
                return next(new ErrorResponse('MR profile not found', 404));
            }

            const doctor = await Doctor.findById(doctorId);
            if (!doctor) {
                return next(new ErrorResponse('Doctor not found', 404));
            }

            if (!doctor.clinic.city.toLowerCase().includes(mr.territory.toLowerCase())) {
                return next(new ErrorResponse('Doctor is not in your territory', 403));
            }

            const pendingMeeting = await MRMeetings.findOne({
                mrId: mr._id,
                doctorId,
                status: constants.MEETING_STATUS.PENDING
            });

            if (pendingMeeting) {
                return next(new ErrorResponse('You already have a pending meeting request with this doctor', 400));
            }


            const meetingRequest = await MRMeetings.create({
                mrId: mr._id,
                doctorId,
                requestedDate: new Date(),
                proposedDate,
                proposedTime,
                purpose,
                products,
                message,
                status: constants.MEETING_STATUS.PENDING
            });

            res.status(201).json({
                success: true,
                message: 'Meeting request sent successfully',
                data: {
                    requestId: meetingRequest.requestId,
                    meetingId: meetingRequest._id,
                    doctorName: doctor.fullName,
                    proposedDate: meetingRequest.formattedProposedDate,
                    proposedTime: meetingRequest.proposedTime,
                    status: meetingRequest.status
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

exports.getMeetingRequests = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            fromDate,
            toDate,
            doctorName,
            page = 1,
            limit = 10
        } = req.query;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }
        const query = { mrId: mr._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.proposedDate = {};
            if (fromDate) query.proposedDate.$gte = new Date(fromDate);
            if (toDate) query.proposedDate.$lte = new Date(toDate);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const meetings = await MRMeetings.find(query)
            .populate('doctorId', 'firstName lastName specialization clinic')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await MRMeetings.countDocuments(query);

        let filteredMeetings = meetings;
        if (doctorName) {
            const nameRegex = new RegExp(doctorName, 'i');
            filteredMeetings = meetings.filter(meeting => {
                const doctor = meeting.doctorId;
                return doctor && (
                    nameRegex.test(doctor.firstName) ||
                    nameRegex.test(doctor.lastName) ||
                    nameRegex.test(`${doctor.firstName} ${doctor.lastName}`)
                );
            });
        }

        const formattedMeetings = filteredMeetings.map(meeting => {
            const doctor = meeting.doctorId;
            return {
                meetingId: meeting._id,
                requestId: meeting.requestId,
                proposedDate: meeting.formattedProposedDate,
                proposedTime: meeting.proposedTime,
                purpose: meeting.purpose,
                status: meeting.status,
                statusColor: meeting.statusColor,
                doctor: doctor ? {
                    doctorId: doctor._id,
                    name: doctor.fullName,
                    specialization: doctor.specialization,
                    clinic: doctor.clinic
                } : null,
                products: meeting.products,
                timeUntilMeeting: meeting.timeUntilMeeting,
                respondedAt: meeting.respondedAt
            };
        });

        res.status(200).json({
            success: true,
            data: formattedMeetings,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.getVisitPlan = async (req, res, next) => {
    try {
        const user = req.user;
        const { date = new Date().toISOString().split('T')[0] } = req.query;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }
        const visitDate = new Date(date);
        const meetings = await MRMeetings.find({
            mrId: mr._id,
            meetingDate: {
                $gte: visitDate,
                $lt: new Date(visitDate.getTime() + 24 * 60 * 60 * 1000)
            },
            status: constants.MEETING_STATUS.APPROVED
        }).populate('doctorId', 'firstName lastName clinic').sort({ meetingTime: 1 });

        const sampleInventory = mr.sampleInventory.filter(sample => sample.quantity > 0);

        res.status(200).json({
            success: true,
            data: {
                date: helpers.formatDate(visitDate, 'long'),
                meetings: meetings.map(meeting => ({
                    meetingId: meeting._id,
                    doctor: meeting.doctorId ? {
                        name: meeting.doctorId.fullName,
                        clinic: meeting.doctorId.clinic
                    } : null,
                    time: meeting.meetingTime,
                    products: meeting.products,
                    expectedDuration: meeting.duration || 30
                })),
                sampleInventory,
                totalMeetings: meetings.length,
                estimatedTravelTime: meetings.length > 0 ? meetings.length * 30 : 0 // 30 min per meeting
            }
        });
    } catch (error) {
        next(error);
    }
};
exports.submitDCR = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            visitDate,
            doctorId,
            productsDiscussed,
            feedback,
            nextFollowUp,
            expensesIncurred = 0,
            samplesDistributed = []
        } = req.body;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return next(new ErrorResponse('Doctor not found', 404));
        }

        const meeting = await MRMeetings.findOne({
            mrId: mr._id,
            doctorId,
            meetingDate: new Date(visitDate),
            status: constants.MEETING_STATUS.APPROVED
        });

        if (!meeting) {
            return next(new ErrorResponse('No approved meeting found for this date and doctor', 404));
        }

        meeting.complete(feedback, samplesDistributed, {
            submittedBy: 'mr',
            submittedAt: new Date()
        });

        if (nextFollowUp) {
            meeting.nextFollowUp = {
                date: nextFollowUp,
                purpose: 'Regular follow-up',
                notes: 'Scheduled during DCR'
            };
        }

        if (expensesIncurred > 0) {
            meeting.addExpense('misc', expensesIncurred, 'DCR reported expenses');
        }

        await meeting.save();

        mr.updatePerformance(true, 0, false);
        await mr.save();

        res.status(201).json({
            success: true,
            message: 'DCR submitted successfully',
            data: {
                dcrId: meeting._id,
                meetingId: meeting._id,
                doctorName: doctor.fullName,
                visitDate: helpers.formatDate(visitDate),
                submittedAt: new Date()
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getDCRList = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            fromDate,
            toDate,
            doctorName,
            page = 1,
            limit = 10
        } = req.query;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }
        const query = {
            mrId: mr._id,
            status: constants.MEETING_STATUS.COMPLETED
        };

        if (fromDate || toDate) {
            query.completedAt = {};
            if (fromDate) query.completedAt.$gte = new Date(fromDate);
            if (toDate) query.completedAt.$lte = new Date(toDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const dcrs = await MRMeetings.find(query)
            .populate('doctorId', 'firstName lastName specialization clinic')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ completedAt: -1 });

        const total = await MRMeetings.countDocuments(query);

        const formattedDCRs = dcrs.map(dcr => {
            const doctor = dcr.doctorId;
            return {
                dcrId: dcr._id,
                visitDate: helpers.formatDate(dcr.meetingDate),
                doctor: doctor ? {
                    doctorId: doctor._id,
                    name: doctor.fullName,
                    specialization: doctor.specialization,
                    clinic: doctor.clinic
                } : null,
                productsDiscussed: dcr.products,
                samplesDistributed: dcr.samplesProvided,
                feedback: dcr.notes,
                expenses: dcr.getTotalExpenses(),
                nextFollowUp: dcr.nextFollowUp?.date,
                submittedAt: dcr.completedAt
            };
        });

        res.status(200).json({
            success: true,
            data: formattedDCRs,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.getSampleInventory = async (req, res, next) => {
    try {
        const user = req.user;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const inventory = mr.sampleInventory.map(sample => ({
            ...sample.toObject(),
            isLowStock: sample.quantity < 10,
            status: sample.quantity === 0 ? 'Out of Stock' :
                sample.quantity < 10 ? 'Low Stock' : 'In Stock'
        }));

        const lowStockItems = inventory.filter(item => item.isLowStock);
        const outOfStockItems = inventory.filter(item => item.quantity === 0);

        res.status(200).json({
            success: true,
            data: {
                inventory,
                summary: {
                    totalProducts: inventory.length,
                    lowStockCount: lowStockItems.length,
                    outOfStockCount: outOfStockItems.length,
                    totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0)
                },
                lowStockItems,
                outOfStockItems
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.distributeSamples = async (req, res, next) => {
    try {
        const user = req.user;
        const { doctorId, samples } = req.body;

        if (!doctorId || !samples || !Array.isArray(samples) || samples.length === 0) {
            return next(new ErrorResponse('Doctor ID and list of samples are required', 400));
        }

        const mr = await MedicalRep.findOne({ userId: user._id });
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return next(new ErrorResponse('Doctor not found', 404));
        }

        for (const sample of samples) {
            if (!sample.sampleName || !sample.quantity) {
                return next(new ErrorResponse('Sample name and quantity are required for each item', 400));
            }
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

        res.status(201).json({
            success: true,
            message: 'Samples distributed successfully',
            data: {
                doctorName: doctor.fullName,
                samplesDistributed: samples,
                remainingStock: mr.sampleInventory
            }
        });
    } catch (error) {
        next(error);
    }
};


exports.getTerritoryAnalytics = async (req, res, next) => {
    try {
        const user = req.user;
        const { period = 'month' } = req.query;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }
        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const completedMeetings = await MRMeetings.find({
            mrId: mr._id,
            status: constants.MEETING_STATUS.COMPLETED,
            completedAt: { $gte: startDate, $lte: now }
        });

        const uniqueDoctors = [...new Set(completedMeetings.map(m => m.doctorId.toString()))];

        const totalSamplesDistributed = completedMeetings.reduce((total, meeting) => {
            return total + (meeting.samplesProvided?.length || 0);
        }, 0);

        const totalExpenses = completedMeetings.reduce((total, meeting) => {
            return total + meeting.getTotalExpenses();
        }, 0);

        const productDistribution = {};
        completedMeetings.forEach(meeting => {
            meeting.products?.forEach(product => {
                if (productDistribution[product.productName]) {
                    productDistribution[product.productName]++;
                } else {
                    productDistribution[product.productName] = 1;
                }
            });
        });

        res.status(200).json({
            success: true,
            data: {
                period,
                dateRange: {
                    from: helpers.formatDate(startDate),
                    to: helpers.formatDate(now)
                },
                performance: {
                    doctorsVisited: uniqueDoctors.length,
                    totalVisits: completedMeetings.length,
                    avgVisitFrequency: uniqueDoctors.length > 0 ?
                        (completedMeetings.length / uniqueDoctors.length).toFixed(1) : 0,
                    samplesDistributed: totalSamplesDistributed,
                    totalExpenses
                },
                targets: {
                    monthlyTarget: mr.monthlyTarget,
                    achieved: mr.achievedTarget,
                    achievementPercentage: mr.achievementPercentage,
                    incentiveEarned: mr.performanceMetrics.incentiveEarned
                },
                productDistribution,
                mrInfo: {
                    name: mr.fullName,
                    territory: mr.territory,
                    company: mr.companyName,
                    tenure: mr.tenure
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getExpenseReport = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            type,
            fromDate,
            toDate,
            page = 1,
            limit = 10
        } = req.query;

        const mr = await MedicalRep.findOne({ userId: user._id });

        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        const query = {
            mrId: mr._id,
            status: constants.MEETING_STATUS.COMPLETED,
            'expenses.0': { $exists: true } // Has at least one expense
        };

        if (fromDate || toDate) {
            query.completedAt = {};
            if (fromDate) query.completedAt.$gte = new Date(fromDate);
            if (toDate) query.completedAt.$lte = new Date(toDate);
        }


        const skip = (parseInt(page) - 1) * parseInt(limit);

        const meetings = await MRMeetings.find(query)
            .populate('doctorId', 'firstName lastName clinic')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ completedAt: -1 });

        const total = await MRMeetings.countDocuments(query);

        const expenses = [];
        meetings.forEach(meeting => {
            meeting.expenses?.forEach(expense => {
                if (!type || expense.type === type) {
                    expenses.push({
                        expenseId: expense._id,
                        meetingId: meeting._id,
                        date: helpers.formatDate(meeting.completedAt),
                        type: expense.type,
                        amount: expense.amount,
                        description: expense.description,
                        doctor: meeting.doctorId ? {
                            name: meeting.doctorId.fullName,
                            clinic: meeting.doctorId.clinic?.name
                        } : null
                    });
                }
            });
        });

        const totalsByType = expenses.reduce((acc, expense) => {
            acc[expense.type] = (acc[expense.type] || 0) + expense.amount;
            return acc;
        }, {});

        const grandTotal = Object.values(totalsByType).reduce((sum, amount) => sum + amount, 0);

        res.status(200).json({
            success: true,
            data: {
                expenses,
                summary: {
                    totalsByType,
                    grandTotal,
                    averagePerMeeting: meetings.length > 0 ? (grandTotal / meetings.length).toFixed(2) : 0,
                    totalMeetings: meetings.length
                },
                pagination: helpers.generatePagination(page, limit, total)
            }
        });
    } catch (error) {
        next(error);
    }
};