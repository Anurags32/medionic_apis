const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// ── Models ────────────────────────────────────────────────────────────────────
const User = require('./models/User');
const Patient = require('./models/Patient');
const Doctor = require('./models/Doctor');
const MedicalRep = require('./models/MedicalRep');
const Appointment = require('./models/Appointment');
const Prescription = require('./models/Prescription');
const PharmacyOrder = require('./models/PharmacyOrder');
const PharmacyProduct = require('./models/PharmacyProduct');
const LabTest = require('./models/LabTest');
const LabBooking = require('./models/LabBooking');
const HealthMetric = require('./models/HealthMetric');
const MRMeetings = require('./models/MRMeetings');
const Chemist = require('./models/Chemist');
const Expense = require('./models/Expense');
const TourPlan = require('./models/TourPlan');
const DCR = require('./models/DCR');
const TokenBlacklist = require('./models/TokenBlacklist');
const FamilyMember = require('./models/FamilyMember');

const constants = require('./config/constants');

// ── DB connection ─────────────────────────────────────────────────────────────
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db');
        console.log('✅  MongoDB connected');
    } catch (err) {
        console.error('❌  MongoDB connection error:', err.message);
        process.exit(1);
    }
};

// ── Static sample data ────────────────────────────────────────────────────────
const PHARMACY_PRODUCTS = [
    {
        name: 'Paracetamol 500mg', brand: 'Cipla', category: 'Pain Relief', price: 25, mrp: 30,
        quantityDescription: 'Strip of 10 tablets', requiresPrescription: false, inStock: true,
        description: 'For relief of mild to moderate pain and fever.'
    },
    {
        name: 'Amoxicillin 250mg', brand: 'GlaxoSmithKline', category: 'Antibiotics', price: 85, mrp: 100,
        quantityDescription: 'Strip of 10 capsules', requiresPrescription: true, inStock: true,
        description: 'Broad-spectrum antibiotic for bacterial infections.'
    },
    {
        name: 'Metformin 500mg', brand: 'Sun Pharma', category: 'Diabetes', price: 45, mrp: 55,
        quantityDescription: 'Strip of 15 tablets', requiresPrescription: true, inStock: true,
        description: 'First-line medication for type 2 diabetes management.'
    },
    {
        name: 'Atorvastatin 10mg', brand: 'Ranbaxy', category: 'Cardiovascular', price: 120, mrp: 140,
        quantityDescription: 'Strip of 10 tablets', requiresPrescription: true, inStock: true,
        description: 'Lowers bad cholesterol and reduces cardiovascular risk.'
    },
    {
        name: 'Cetirizine 10mg', brand: 'Dr. Reddy\'s', category: 'Allergy', price: 20, mrp: 28,
        quantityDescription: 'Strip of 10 tablets', requiresPrescription: false, inStock: true,
        description: 'Antihistamine for allergic rhinitis and urticaria.'
    },
    {
        name: 'Omeprazole 20mg', brand: 'Cipla', category: 'Gastric', price: 55, mrp: 65,
        quantityDescription: 'Strip of 10 capsules', requiresPrescription: false, inStock: true,
        description: 'Proton pump inhibitor for acid reflux and ulcers.'
    },
    {
        name: 'Vitamin D3 1000 IU', brand: 'Abbott', category: 'Vitamins & Supplements', price: 180, mrp: 220,
        quantityDescription: 'Bottle of 60 soft-gels', requiresPrescription: false, inStock: true,
        description: 'Supports bone health and immune function.'
    },
    {
        name: 'Azithromycin 500mg', brand: 'Pfizer', category: 'Antibiotics', price: 95, mrp: 110,
        quantityDescription: 'Strip of 3 tablets', requiresPrescription: true, inStock: false,
        description: 'Macrolide antibiotic for respiratory and skin infections.'
    },
    {
        name: 'Ibuprofen 400mg', brand: 'Micro Labs', category: 'Pain Relief', price: 30, mrp: 38,
        quantityDescription: 'Strip of 10 tablets', requiresPrescription: false, inStock: true,
        description: 'NSAID for pain, inflammation, and fever.'
    },
    {
        name: 'Pantoprazole 40mg', brand: 'Aristo Pharma', category: 'Gastric', price: 60, mrp: 72,
        quantityDescription: 'Strip of 10 tablets', requiresPrescription: false, inStock: true,
        description: 'For gastroesophageal reflux disease (GERD) and peptic ulcers.'
    }
];

const LAB_TESTS = [
    { name: 'Complete Blood Count (CBC)', description: 'Measures different components of blood including RBC, WBC, and platelets.', price: 350, sampleType: 'Blood' },
    { name: 'Lipid Profile', description: 'Measures cholesterol levels (total, HDL, LDL) and triglycerides.', price: 600, sampleType: 'Blood' },
    { name: 'Blood Glucose Fasting', description: 'Measures blood sugar level after 8-hour fast. Used to diagnose diabetes.', price: 120, sampleType: 'Blood' },
    { name: 'HbA1c', description: 'Average blood sugar control over the past 2–3 months.', price: 500, sampleType: 'Blood' },
    { name: 'Thyroid Function Test (TSH)', description: 'Evaluates thyroid gland activity.', price: 450, sampleType: 'Blood' },
    { name: 'Liver Function Test (LFT)', description: 'Assesses liver health — enzymes, bilirubin, proteins.', price: 700, sampleType: 'Blood' },
    { name: 'Kidney Function Test (KFT)', description: 'Evaluates kidney health — creatinine, urea, electrolytes.', price: 650, sampleType: 'Blood' },
    { name: 'Urine Routine Examination', description: 'Screens urine for infection, kidney disease, and other conditions.', price: 150, sampleType: 'Urine' },
    { name: 'Chest X-Ray', description: 'Imaging of lungs and chest to detect infections or structural issues.', price: 400, sampleType: 'Imaging' },
    { name: 'ECG (Electrocardiogram)', description: 'Records electrical activity of the heart.', price: 300, sampleType: 'Physical' },
    { name: 'Vitamin B12', description: 'Checks vitamin B12 levels — important for nerve and red blood cell health.', price: 550, sampleType: 'Blood' },
    { name: 'COVID-19 RT-PCR', description: 'Detects active SARS-CoV-2 infection.', price: 800, sampleType: 'Nasopharyngeal Swab' }
];

// ── Main seed function ────────────────────────────────────────────────────────
const seedDatabase = async () => {
    console.log('\n🌱  Starting database seed...\n');

    // Clear all collections
    await Promise.all([
        User.deleteMany({}), Patient.deleteMany({}), Doctor.deleteMany({}),
        MedicalRep.deleteMany({}), Appointment.deleteMany({}), Prescription.deleteMany({}),
        PharmacyOrder.deleteMany({}), PharmacyProduct.deleteMany({}),
        LabTest.deleteMany({}), LabBooking.deleteMany({}), HealthMetric.deleteMany({}),
        MRMeetings.deleteMany({}), Chemist.deleteMany({}), Expense.deleteMany({}),
        TourPlan.deleteMany({}), DCR.deleteMany({}), TokenBlacklist.deleteMany({}),
        FamilyMember.deleteMany({})
    ]);
    console.log('🗑   Cleared existing data');

    // ── Pharmacy Products ─────────────────────────────────────────────────────
    const products = await PharmacyProduct.insertMany(PHARMACY_PRODUCTS);
    console.log(`💊  Created ${products.length} pharmacy products`);

    // ── Lab Tests ─────────────────────────────────────────────────────────────
    const labTests = await LabTest.insertMany(LAB_TESTS);
    console.log(`🧪  Created ${labTests.length} lab tests`);

    // ── Admin user ────────────────────────────────────────────────────────────
    const adminUser = await User.create({
        firstName: 'Platform', lastName: 'Admin',
        email: 'admin@healthcare.com', password: 'Admin@1234',
        phone: '9000000000', role: constants.ROLES.ADMIN,
        isVerified: true, status: constants.USER_STATUS.ACTIVE
    });
    console.log('👤  Created admin user');

    // ── Doctor users ──────────────────────────────────────────────────────────
    const doctorDefs = [
        {
            firstName: 'Rajesh', lastName: 'Sharma', email: 'dr.sharma@hospital.com',
            specialization: 'Cardiology', licenseNumber: 'KA-MED-2010-0042',
            registrationCouncil: 'Karnataka Medical Council', qualification: 'MBBS, MD (Cardiology)',
            yearsExperience: 14, clinicName: 'HeartCare Clinic',
            clinicAddress: '12 MG Road, Indiranagar, Bangalore, Karnataka, 560038',
            city: 'Bangalore', consultationFee: 800
        },
        {
            firstName: 'Priya', lastName: 'Mehta', email: 'dr.mehta@wellness.com',
            specialization: 'Dermatology', licenseNumber: 'MH-MED-2015-1120',
            registrationCouncil: 'Maharashtra Medical Council', qualification: 'MBBS, MD (Dermatology)',
            yearsExperience: 9, clinicName: 'SkinGlow Dermatology',
            clinicAddress: '45 FC Road, Shivajinagar, Pune, Maharashtra, 411004',
            city: 'Pune', consultationFee: 600
        },
        {
            firstName: 'Arun', lastName: 'Krishnan', email: 'dr.krishnan@neurology.com',
            specialization: 'Neurology', licenseNumber: 'TN-MED-2008-0334',
            registrationCouncil: 'Tamil Nadu Medical Council', qualification: 'MBBS, DM (Neurology)',
            yearsExperience: 16, clinicName: 'NeuroPlus Brain & Spine',
            clinicAddress: '78 Anna Salai, Teynampet, Chennai, Tamil Nadu, 600018',
            city: 'Chennai', consultationFee: 1000
        }
    ];

    const weekdaySchedule = {
        monday: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
        tuesday: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
        wednesday: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
        thursday: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }],
        friday: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
        saturday: [{ start: '10:00', end: '13:00' }],
        sunday: []
    };

    const doctorUsers = [];
    const doctorProfiles = [];
    for (const def of doctorDefs) {
        const u = await User.create({
            firstName: def.firstName, lastName: def.lastName,
            email: def.email, password: 'Doctor@1234',
            phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
            role: constants.ROLES.DOCTOR, isVerified: true, status: constants.USER_STATUS.ACTIVE
        });
        const d = await Doctor.create({
            userId: u._id,
            firstName: def.firstName, lastName: def.lastName,
            licenseNumber: def.licenseNumber, registrationCouncil: def.registrationCouncil,
            qualification: def.qualification, specialization: def.specialization,
            yearsExperience: def.yearsExperience,
            clinic: { name: def.clinicName, address: def.clinicAddress, city: def.city, phone: '+919812345001' },
            consultationFee: def.consultationFee,
            verificationStatus: constants.VERIFICATION_STATUS.VERIFIED,
            rating: parseFloat((3.8 + Math.random() * 1.2).toFixed(1)),
            reviewsCount: Math.floor(20 + Math.random() * 80),
            slotDurationMinutes: 30,
            schedule: weekdaySchedule,
            bio: `Experienced ${def.specialization} specialist with ${def.yearsExperience} years of practice.`
        });
        doctorUsers.push(u);
        doctorProfiles.push(d);
    }
    console.log(`👨‍⚕️  Created ${doctorProfiles.length} doctors`);

    // ── Patient users ─────────────────────────────────────────────────────────
    const patientDefs = [
        {
            firstName: 'Aarav', lastName: 'Gupta', email: 'aarav.gupta@gmail.com',
            phone: '9876543210', gender: 'male', dob: new Date('1990-04-12'),
            address: { street: '23 Park Street', city: 'Kolkata', state: 'West Bengal', zip: '700016' },
            bloodGroup: 'O+', emergencyContact: { name: 'Sunita Gupta', phone: '9876543200', relation: 'Mother' }
        },
        {
            firstName: 'Sneha', lastName: 'Patel', email: 'sneha.patel@gmail.com',
            phone: '9765432109', gender: 'female', dob: new Date('1995-11-25'),
            address: { street: '7 Ashram Road', city: 'Ahmedabad', state: 'Gujarat', zip: '380009' },
            bloodGroup: 'A+', emergencyContact: { name: 'Ramesh Patel', phone: '9765432100', relation: 'Father' }
        }
    ];

    const patientUsers = [];
    const patientProfiles = [];
    for (const def of patientDefs) {
        const u = await User.create({
            firstName: def.firstName, lastName: def.lastName,
            email: def.email, password: 'Patient@1234',
            phone: def.phone, role: constants.ROLES.PATIENT,
            isVerified: true, status: constants.USER_STATUS.ACTIVE
        });
        const p = await Patient.create({
            userId: u._id,
            firstName: def.firstName, lastName: def.lastName,
            dob: def.dob, gender: def.gender,
            address: def.address, rawAddress: Object.values(def.address).join(', '),
            bloodGroup: def.bloodGroup, emergencyContact: def.emergencyContact
        });
        patientUsers.push(u);
        patientProfiles.push(p);
    }
    console.log(`🧑‍🤝‍🧑  Created ${patientProfiles.length} patients`);

    // ── Family member ─────────────────────────────────────────────────────────
    await FamilyMember.create({
        patientId: patientProfiles[0]._id,
        fullName: 'Riya Gupta', relation: 'Sister',
        dob: new Date('1995-08-18'), gender: 'female'
    });

    // ── MR users ──────────────────────────────────────────────────────────────
    const mrDefs = [
        {
            firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@pharmamax.com',
            phone: '9812345678', companyName: 'PharmaMax Inc.', employeeId: 'PM-2021-001',
            designation: 'Senior Medical Representative', territory: 'Bangalore North'
        },
        {
            firstName: 'Kavya', lastName: 'Nair', email: 'kavya.nair@medilife.com',
            phone: '9823456789', companyName: 'MediLife Pharma', employeeId: 'ML-2022-045',
            designation: 'Medical Representative', territory: 'Mumbai West'
        }
    ];

    const mrUsers = [];
    const mrProfiles = [];
    for (const def of mrDefs) {
        const u = await User.create({
            firstName: def.firstName, lastName: def.lastName,
            email: def.email, password: 'MRep@1234',
            phone: def.phone, role: constants.ROLES.MR,
            isVerified: true, status: constants.USER_STATUS.ACTIVE
        });
        const mr = await MedicalRep.create({
            userId: u._id,
            firstName: def.firstName, lastName: def.lastName,
            companyName: def.companyName,
            designation: def.designation, territory: def.territory,
            verificationStatus: constants.VERIFICATION_STATUS.VERIFIED,
            employmentDetails: {
                joiningDate: new Date(),
                employeeId: def.employeeId,
                department: 'Sales'
            },
            sampleInventory: [
                { productId: products[0]._id, productName: 'CardioPlus 10mg', batchNo: 'CP2024Q2-001', quantity: 50, expiryDate: new Date('2025-12-31') },
                { productId: products[1]._id, productName: 'NeuroClear 5mg', batchNo: 'NC2024Q1-010', quantity: 30, expiryDate: new Date('2025-06-30') }
            ]
        });
        mrUsers.push(u);
        mrProfiles.push(mr);
    }
    console.log(`🧑‍💼  Created ${mrProfiles.length} MRs`);

    // ── Appointments ──────────────────────────────────────────────────────────
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 3); dayAfter.setHours(0, 0, 0, 0);

    const apt1 = await Appointment.create({
        patientId: patientProfiles[0]._id, doctorId: doctorProfiles[0]._id,
        appointmentDate: tomorrow, appointmentTime: '10:00',
        consultationType: 'clinic', symptoms: 'Chest pain and occasional breathlessness for 2 weeks.',
        status: 'confirmed', amount: doctorProfiles[0].consultationFee, paymentStatus: 'completed'
    });
    const apt2 = await Appointment.create({
        patientId: patientProfiles[1]._id, doctorId: doctorProfiles[1]._id,
        appointmentDate: dayAfter, appointmentTime: '11:30',
        consultationType: 'video', symptoms: 'Persistent skin rash and itching on arms.',
        status: 'pending', amount: doctorProfiles[1].consultationFee, paymentStatus: 'pending'
    });
    const apt3 = await Appointment.create({
        patientId: patientProfiles[0]._id, doctorId: doctorProfiles[2]._id,
        appointmentDate: dayAfter, appointmentTime: '14:00',
        consultationType: 'chat', symptoms: 'Frequent headaches and dizziness.',
        status: 'confirmed', amount: doctorProfiles[2].consultationFee, paymentStatus: 'completed'
    });
    console.log('📅  Created 3 appointments');

    // ── Prescriptions ─────────────────────────────────────────────────────────
    await Prescription.create({
        appointmentId: apt1._id, patientId: patientProfiles[0]._id, doctorId: doctorProfiles[0]._id,
        diagnosis: 'Stable Angina — further cardiac workup recommended.',
        medicines: [
            { medicineName: 'Aspirin 75mg', dosage: '75mg', frequency: 'Once daily', duration: '30 days', instructions: 'Take after breakfast', quantity: 30 },
            { medicineName: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'Once at night', duration: '30 days', instructions: 'Take after dinner', quantity: 30 }
        ],
        instructions: ['Avoid strenuous exercise', 'Low-salt diet', 'Follow up in 1 month'],
        followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    console.log('📋  Created 1 prescription');

    // ── Pharmacy order ────────────────────────────────────────────────────────
    await PharmacyOrder.create({
        patientId: patientProfiles[0]._id,
        orderNumber: 'ORD-12345',
        medicines: [
            { medicineName: 'Paracetamol 500mg', quantity: 2, price: 25 },
            { medicineName: 'Omeprazole 20mg', quantity: 1, price: 55 }
        ],
        totalAmount: 105, discountApplied: 0, taxAmount: 0, finalAmount: 105,
        paymentMethod: 'UPI', paymentStatus: 'completed',
        deliveryAddress: {
            street: '23 Park Street', city: 'Kolkata', state: 'West Bengal',
            zip: '700016', contactPhone: '9876543210'
        },
        status: 'confirmed'
    });
    console.log('🛒  Created 1 pharmacy order');

    // ── Lab booking ───────────────────────────────────────────────────────────
    const labDate = new Date(); labDate.setDate(labDate.getDate() + 2);
    await LabBooking.create({
        patientId: patientProfiles[0]._id,
        testIds: [labTests[0]._id, labTests[1]._id],
        scheduledAt: labDate,
        address: '23 Park Street, Kolkata, West Bengal 700016',
        status: 'pending'
    });
    console.log('🧫  Created 1 lab booking');

    // ── Chemists for MR ───────────────────────────────────────────────────────
    await Chemist.create({
        mrId: mrUsers[0]._id,
        chemistName: 'LifeCare Pharmacy',
        contactPerson: 'Suresh Kumar',
        phone: '9876543001',
        address: '15 Commercial Street', city: 'Bangalore'
    });

    // ── Expenses for MR ───────────────────────────────────────────────────────
    await Expense.create({
        mrId: mrUsers[0]._id, amount: 850,
        expenseType: 'travel', category: 'travel', date: new Date(),
        description: 'Cab fare for Bangalore North clinic visits', approvalStatus: 'pending'
    });

    // ── Tour plan for MR ──────────────────────────────────────────────────────
    await TourPlan.create({
        mrId: mrUsers[0]._id,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        routes: [{
            date: tomorrow,
            territory: 'Bangalore North',
            objective: 'Introduce CardioPlus 10mg to cardiologists at HeartCare Clinic'
        }]
    });
    console.log('🗺   Created MR Chemist, Expense, and TourPlan');

    // ── MR Meeting request ────────────────────────────────────────────────────
    await MRMeetings.create({
        mrId: mrUsers[0]._id,
        doctorId: doctorProfiles[0]._id,
        requestId: 'MRM260712345',
        requestedDate: new Date(),
        proposedDate: dayAfter,
        proposedTime: '10:00',
        purpose: 'Product presentation: CardioPlus 10mg',
        status: 'pending'
    });
    console.log('🤝  Created 1 MR meeting request');

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n============================================================');
    console.log('✅  Database seeded successfully!');
    console.log('============================================================');
    console.log('\n🔑  Sample Login Credentials:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('👤  Admin   : admin@healthcare.com          / Admin@1234');
    console.log('👨‍⚕️  Doctor  : dr.sharma@hospital.com       / Doctor@1234');
    console.log('👨‍⚕️  Doctor  : dr.mehta@wellness.com        / Doctor@1234');
    console.log('👨‍⚕️  Doctor  : dr.krishnan@neurology.com    / Doctor@1234');
    console.log('🧑  Patient : aarav.gupta@gmail.com         / Patient@1234');
    console.log('🧑  Patient : sneha.patel@gmail.com         / Patient@1234');
    console.log('🧑‍💼  MR      : vikram.singh@pharmamax.com   / MRep@1234');
    console.log('🧑‍💼  MR      : kavya.nair@medilife.com      / MRep@1234');
    console.log('============================================================\n');
};

// ── Entry point ───────────────────────────────────────────────────────────────
const runSeed = async () => {
    await connectDB();
    await seedDatabase();
    await mongoose.disconnect();
    process.exit(0);
};

if (require.main === module) {
    runSeed();
}

module.exports = { seedDatabase, connectDB };
