const mongoose = require('mongoose');

const Branch = require('./branch.model');

const User = require('./user.model');
const Category = require('./category.model');
const Medicine = require('./medicine.model');
const MedicineBatch = require('./batch.model');
const Customer = require('./customer.model');
const Prescription = require('./prescription.model');
const Order = require('./order.model');
const { OrderItem } = require('./order-item.model');
const Invoice = require('./invoice.model');
const { InvoiceItem } = require('./invoice-item.model');
const StockLog = require('./stock-log.model');
const Notification = require('./notification.model');
const OTP = require('./otp.model');
const PharmacyReturn = require('./return.model');
const PlanPayment = require('./plan-payment.model');

module.exports = {
    mongoose,
    Branch,

    User,
    Category,
    Medicine,
    MedicineBatch,
    Customer,
    Prescription,
    Order,
    OrderItem,
    Invoice,
    InvoiceItem,
    StockLog,
    Notification,
    OTP,
    PharmacyReturn,
    PlanPayment,
};