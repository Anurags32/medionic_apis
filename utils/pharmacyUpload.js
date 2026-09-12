const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('./ApiError');

const createDirIfNotExist = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const prescriptionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/prescriptions');
        createDirIfNotExist(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `rx-${uniqueSuffix}${ext}`);
    },
});

const medicineStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/medicines');
        createDirIfNotExist(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `med-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, WEBP, and PDF are allowed.', 'INVALID_FILE_TYPE'), false);
    }
};

const uploadPrescription = multer({
    storage: prescriptionStorage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadMedicineImage = multer({
    storage: medicineStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = {
    uploadPrescription,
    uploadMedicineImage,
};
