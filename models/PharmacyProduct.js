const mongoose = require('mongoose');

const pharmacyProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    brand: {
        type: String,
        required: [true, 'Brand name is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        index: true
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    mrp: {
        type: Number,
        required: [true, 'MRP is required'],
        min: [0, 'MRP cannot be negative']
    },
    quantityDescription: {
        type: String,
        required: [true, 'Quantity description is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    requiresPrescription: {
        type: Boolean,
        default: false
    },
    inStock: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for search performance
pharmacyProductSchema.index({ name: 'text', brand: 'text', description: 'text' });

const PharmacyProduct = mongoose.model('PharmacyProduct', pharmacyProductSchema);

module.exports = PharmacyProduct;
