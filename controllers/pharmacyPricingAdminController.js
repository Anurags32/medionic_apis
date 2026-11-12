/**
 * Admin panel: pharmacy plans & pricing, and store subscriptions.
 * Mounted under /api/admin/pharmacy (admin token required).
 */
const asyncHandler = require('../utils/asyncHandler');
const pricing = require('../services/pharmacy/pricing.service');
const subscriptions = require('../services/pharmacy/subscriptionAdmin.service');

const actorOf = (req) => ({
    id: req.user?._id,
    name: [req.user?.firstName, req.user?.lastName].filter(Boolean).join(' ') || req.user?.email || 'Admin',
});

const settingsView = (s) => ({
    trial_days: s.trial_days,
    yearly_months_charged: s.yearly_months_charged,
    onboarding_fee: s.onboarding_fee,
    data_import_included: s.data_import_included,
    updated_by_name: s.updated_by_name || '',
    updated_at: s.updated_at || null,
});

exports.getPlans = asyncHandler(async (req, res) => {
    const [plans, settings] = await Promise.all([pricing.listPlansForAdmin(), pricing.getSettings()]);
    res.status(200).json({ success: true, data: { plans, settings: settingsView(settings) } });
});

exports.createPlan = asyncHandler(async (req, res) => {
    const plan = await pricing.createPlan(req.body);
    res.status(201).json({ success: true, message: `Plan '${plan.name}' created`, data: plan });
});

exports.updatePlan = asyncHandler(async (req, res) => {
    const plan = await pricing.updatePlan(req.params.planId, req.body);
    res.status(200).json({ success: true, message: `Plan '${plan.name}' saved`, data: plan });
});

exports.updateSettings = asyncHandler(async (req, res) => {
    const settings = await pricing.updateSettings(req.body, actorOf(req).name);
    res.status(200).json({ success: true, message: 'Pricing settings saved', data: settingsView(settings) });
});

exports.getSubscriptions = asyncHandler(async (req, res) => {
    const result = await subscriptions.listSubscriptions(req.query);
    res.status(200).json({ success: true, data: result.stores, pagination: result.pagination, summary: result.summary });
});

exports.getSubscriptionHistory = asyncHandler(async (req, res) => {
    const history = await subscriptions.getHistory(req.params.branchId);
    res.status(200).json({ success: true, data: history });
});

exports.extendTrial = asyncHandler(async (req, res) => {
    const subscription = await subscriptions.extendTrial(req.params.branchId, req.body, actorOf(req));
    res.status(200).json({ success: true, message: 'Trial extended', data: subscription });
});

exports.activatePlan = asyncHandler(async (req, res) => {
    const result = await subscriptions.activatePlan(req.params.branchId, req.body, actorOf(req));
    res.status(200).json({ success: true, message: 'Plan activated', data: result });
});
