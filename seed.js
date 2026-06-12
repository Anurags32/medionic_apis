const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./models/User');
const Patient = require('./models/Patient');
const Doctor = require('./models/Doctor');
const MedicalRep = require('./models/MedicalRep');
const Appointment = require('./models/Appointment');
const Prescription = require('./models/Prescription');
const PharmacyOrder = require('./models/PharmacyOrder');
const HealthMetric = require('./models/HealthMetric');
const MRMeetings = require('./models/MRMeetings');

const constants = require('./config/constants');
const helpers = require('./utils/helpers');

// Connect to database
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Sample data
const sampleData = {
    users: [
        // Patients
        { email: 'john.doe@email.com', password: 'Password123!', role: 'patient' },
        { email: 'jane.smith@email.com', password: 'Password123!', role: 'patient' },
        { email: 'mike.johnson@email.com', password: 'Password123!', role: 'patient' },
        { email: 'sarah.wilson@email.com', password: 'Password123!', role: 'patient' },
        { email: 'david.brown@email.com', password: 'Password123!', role: 'patient' },

        // Doctors
        { email: 'dr.smith@hospital.com', password: 'Password123!', role: 'doctor' },
        { email: 'dr.johnson@clinic.com', password: 'Password123!', role: 'doctor' },
        { email: 'dr.williams@medical.com', password: 'Password123!', role: 'doctor' },
        { email: 'dr.davis@healthcare.com', password: 'Password123!', role: 'doctor' },
        { email: 'dr.miller@hospital.com', password: 'Password123!', role: 'doctor' },

        // Medical Representatives
        { email: 'mr.jones@pharma.com', password: 'Password123!', role: 'mr' },
        { email: 'mr.taylor@medco.com', password: 'Password123!', role: 'mr' },
        { email: 'mr.anderson@biopharma.com', password: 'Password123!', role: 'mr' },

        // Admin
        { email: 'admin@healthcare.com', password: 'Password123!', role: 'admin' }
    ],

    patients: [
        {
            firstName: 'John',
            lastName: 'Doe',
            dob: new Date('1985-06-15'),
            gender: 'male',
            address: {
                street: '123 Main St',
                city: 'New York',
                state: 'NY',
                zip: '10001'
            },
            bloodGroup: 'O+',
            emergencyContact: {
                name: 'Jane Doe',
                phone: '+1234567890',
                relation: 'Spouse'
            }
        },
        {
            firstName: 'Jane',
            lastName: 'Smith',
            dob: new Date('1990-03-22'),
            gender: 'female',
            address: {
                street: '456 Oak Ave',
                city: 'Los Angeles',
                state: 'CA',
                zip: '90210'
            },
            bloodGroup: 'A+',
            emergencyContact: {
                name: 'Robert Smith',
                phone: '+1234567891',
                relation: 'Father'
            }
        },
        {
            firstName: 'Mike',
            lastName: 'Johnson',
            dob: new Date('1978-11-08'),
            gender: 'male',
            address: {
                street: '789 Pine Rd',
                city: 'Chicago',
                state: 'IL',
                zip: '60601'
            },
            bloodGroup: 'B+',
            emergencyContact: {
                name: 'Lisa Johnson',
                phone: '+1234567892',
                relation: 'Wife'
            }
        },
        {
            firstName: 'Sarah',
            lastName: 'Wilson',
            dob: new Date('1995-09-14'),
            gender: 'female',
            address: {
                street: '321 Elm St',
                city: 'Houston',
                state: 'TX',
                zip: '77001'
            },
            bloodGroup: 'AB+',
            emergencyContact: {
                name: 'Tom Wilson',
                phone: '+1234567893',
                relation: 'Brother'
            }
        },
        {
            firstName: 'David',
            lastName: 'Brown',
            dob: new Date('1982-12-03'),
            gender: 'male',
            address: {
                street: '654 Cedar Ln',
                city: 'Phoenix',
                state: 'AZ',
                zip: '85001'
            },
            bloodGroup: 'O-',
            emergencyContact: {
                name: 'Mary Brown',
                phone: '+1234567894',
                relation: 'Mother'
            }
        }
    ],

    doctors: [
        {
            firstName: 'Robert',
            lastName: 'Smith',
            specialization: 'Cardiology',
            licenseNumber: 'MD001234',
            yearsExperience: 15,
            clinic: {
                name: 'Heart Care Center',
                address: '100 Medical Plaza',
                city: 'New York',
                phone: '+1555001001'
            },
            consultationFee: 200,
            bio: 'Experienced cardiologist specializing in heart disease prevention and treatment.'
        },
        {
            firstName: 'Emily',
            lastName: 'Johnson',
            specialization: 'Dermatology',
            licenseNumber: 'MD001235',
            yearsExperience: 8,
            clinic: {
                name: 'Skin Health Clinic',
                address: '200 Wellness St',
                city: 'Los Angeles',
                phone: '+1555001002'
            },
            consultationFee: 150,
            bio: 'Board-certified dermatologist focused on skin cancer prevention and cosmetic dermatology.'
        },
        {
            firstName: 'Michael',
            lastName: 'Williams',
            specialization: 'Orthopedics',
            licenseNumber: 'MD001236',
            yearsExperience: 12,
            clinic: {
                name: 'Bone & Joint Institute',
                address: '300 Sports Medicine Dr',
                city: 'Chicago',
                phone: '+1555001003'
            },
            consultationFee: 180,
            bio: 'Orthopedic surgeon specializing in sports medicine and joint replacement.'
        },
        {
            firstName: 'Lisa',
            lastName: 'Davis',
            specialization: 'Pediatrics',
            licenseNumber: 'MD001237',
            yearsExperience: 10,
            clinic: {
                name: 'Children\'s Health Center',
                address: '400 Family Care Blvd',
                city: 'Houston',
                phone: '+1555001004'
            },
            consultationFee: 120,
            bio: 'Pediatrician dedicated to comprehensive healthcare for children from infancy to adolescence.'
        },
        {
            firstName: 'James',
            lastName: 'Miller',
            specialization: 'Internal Medicine',
            licenseNumber: 'MD001238',
            yearsExperience: 20,
            clinic: {
                name: 'Primary Care Associates',
                address: '500 Healthcare Way',
                city: 'Phoenix',
                phone: '+1555001005'
            },
            consultationFee: 160,
            bio: 'Internal medicine physician providing comprehensive primary care for adults.'
        }
    ],

    medicalReps: [
        {
            firstName: 'Alex',
            lastName: 'Jones',
            companyName: 'PharmaMax Inc.',
            territory: 'New York',
            designation: 'Senior Medical Representative',
            employmentDetails: {
                joiningDate: new Date('2020-01-15'),
                employeeId: 'PM001',
                department: 'Sales'
            }
        },
        {
            firstName: 'Maria',
            lastName: 'Taylor',
            companyName: 'MedCorp Solutions',
            territory: 'Los Angeles',
            designation: 'Medical Representative',
            employmentDetails: {
                joiningDate: new Date('2021-03-10'),
                employeeId: 'MC002',
                department: 'Sales'
            }
        },
        {
            firstName: 'Chris',
            lastName: 'Anderson',
            companyName: 'BioPharma Ltd.',
            territory: 'Chicago',
            designation: 'Regional Sales Manager',
            employmentDetails: {
                joiningDate: new Date('2019-07-22'),
                employeeId: 'BP003',
                department: 'Sales'
            }
        }
    ]
};

// Seed function
const seedDatabase = async () => {
    try {
        console.log('Starting database seed...');

        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Patient.deleteMany({}),
            Doctor.deleteMany({}),
            MedicalRep.deleteMany({}),
            Appointment.deleteMany({}),
            Prescription.deleteMany({}),
            PharmacyOrder.deleteMany({}),
            HealthMetric.deleteMany({}),
            MRMeetings.deleteMany({})
        ]);

        console.log('Cleared existing data');

        // Create users
        const users = [];
        for (const userData of sampleData.users) {
            const user = await User.create({
                ...userData,
                profileComplete: true,
                status: constants.USER_STATUS.ACTIVE
            });
            users.push(user);
        }

        console.log(`Created ${users.length} users`);

        // Create patients
        const patients = [];
        const patientUsers = users.filter(u => u.role === constants.ROLES.PATIENT);
        for (let i = 0; i < sampleData.patients.length; i++) {
            const patient = await Patient.create({
                ...sampleData.patients[i],
                userId: patientUsers[i]._id
            });
            patients.push(patient);
        }

        console.log(`Created ${patients.length} patients`);

        // Create doctors
        const doctors = [];
        const doctorUsers = users.filter(u => u.role === constants.ROLES.DOCTOR);
        for (let i = 0; i < sampleData.doctors.length; i++) {
            const doctor = await Doctor.create({
                ...sampleData.doctors[i],
                userId: doctorUsers[i]._id,
                verificationStatus: constants.VERIFICATION_STATUS.VERIFIED,
                rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
                totalRatings: Math.floor(Math.random() * 100) + 10,
                availability: {
                    monday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }],
                    tuesday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }],
                    wednesday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }],
                    thursday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }],
                    friday: [{ startTime: '09:00', endTime: '17:00', maxPatients: 20 }],
                    saturday: [{ startTime: '09:00', endTime: '13:00', maxPatients: 10 }]
                }
            });
            doctors.push(doctor);
        }

        console.log(`Created ${doctors.length} doctors`);

        // Create medical reps
        const medicalReps = [];
        const mrUsers = users.filter(u => u.role === constants.ROLES.MR);
        for (let i = 0; i < sampleData.medicalReps.length; i++) {
            const mr = await MedicalRep.create({
                ...sampleData.medicalReps[i],
                userId: mrUsers[i]._id,
                monthlyTarget: 50000 + Math.floor(Math.random() * 30000),
                achievedTarget: Math.floor(Math.random() * 40000) + 20000,
                productsHandled: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        productName: 'Cardio Plus',
                        category: 'Cardiovascular',
                        targetUnits: 1000
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        productName: 'Pain Relief Max',
                        category: 'Pain Management',
                        targetUnits: 800
                    }
                ],
                sampleInventory: [
                    {
                        productId: new mongoose.Types.ObjectId(),
                        productName: 'Cardio Plus',
                        quantity: 50,
                        batchNo: 'CP2024001'
                    },
                    {
                        productId: new mongoose.Types.ObjectId(),
                        productName: 'Pain Relief Max',
                        quantity: 30,
                        batchNo: 'PRM2024001'
                    }
                ]
            });
            medicalReps.push(mr);
        }

        console.log(`Created ${medicalReps.length} medical representatives`);

        // Create sample appointments
        const appointments = [];
        for (let i = 0; i < 10; i++) {
            const patient = patients[Math.floor(Math.random() * patients.length)];
            const doctor = doctors[Math.floor(Math.random() * doctors.length)];

            const appointmentDate = new Date();
            appointmentDate.setDate(appointmentDate.getDate() + Math.floor(Math.random() * 30) - 15);

            const appointment = await Appointment.create({
                patientId: patient._id,
                doctorId: doctor._id,
                appointmentDate,
                appointmentTime: `${9 + Math.floor(Math.random() * 8)}:00`,
                consultationType: ['video', 'chat', 'clinic'][Math.floor(Math.random() * 3)],
                symptoms: [
                    'Chest pain and shortness of breath',
                    'Skin rash and itching',
                    'Joint pain and stiffness',
                    'Fever and headache',
                    'Back pain'
                ][Math.floor(Math.random() * 5)],
                status: ['pending', 'confirmed', 'completed'][Math.floor(Math.random() * 3)],
                amount: doctor.consultationFee
            });
            appointments.push(appointment);
        }

        console.log(`Created ${appointments.length} appointments`);

        // Create sample prescriptions
        const prescriptions = [];
        const completedAppointments = appointments.filter(a => a.status === 'completed');

        for (const appointment of completedAppointments) {
            const prescription = await Prescription.create({
                doctorId: appointment.doctorId,
                patientId: appointment.patientId,
                appointmentId: appointment._id,
                medicines: [
                    {
                        medicineName: 'Aspirin',
                        dosage: '81mg',
                        frequency: 'Once daily',
                        duration: '30 days',
                        quantity: 30,
                        instructions: 'Take with food'
                    },
                    {
                        medicineName: 'Lisinopril',
                        dosage: '10mg',
                        frequency: 'Once daily',
                        duration: '30 days',
                        quantity: 30,
                        instructions: 'Take in the morning'
                    }
                ],
                testRecommendations: [
                    {
                        testName: 'Blood Pressure Check',
                        urgency: 'routine'
                    }
                ],
                notes: 'Follow up in 2 weeks',
                status: constants.PRESCRIPTION_STATUS.ACTIVE
            });
            prescriptions.push(prescription);
        }

        console.log(`Created ${prescriptions.length} prescriptions`);

        // Create sample health metrics
        const healthMetrics = [];
        for (const patient of patients) {
            // Create 10 random health metrics for each patient
            for (let i = 0; i < 10; i++) {
                const metricTypes = Object.values(constants.HEALTH_METRICS);
                const metricType = metricTypes[Math.floor(Math.random() * metricTypes.length)];

                let value, unit;
                switch (metricType) {
                    case 'BP':
                        value = `${120 + Math.floor(Math.random() * 40)}/${80 + Math.floor(Math.random() * 20)}`;
                        unit = 'mmHg';
                        break;
                    case 'HR':
                        value = 60 + Math.floor(Math.random() * 40);
                        unit = 'bpm';
                        break;
                    case 'Weight':
                        value = 60 + Math.floor(Math.random() * 40);
                        unit = 'kg';
                        break;
                    case 'Glucose':
                        value = 80 + Math.floor(Math.random() * 60);
                        unit = 'mg/dL';
                        break;
                    case 'Temperature':
                        value = parseFloat((36.5 + Math.random() * 2).toFixed(1));
                        unit = 'C';
                        break;
                }

                const metric = await HealthMetric.create({
                    patientId: patient._id,
                    metricType,
                    value,
                    unit,
                    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                    source: 'manual'
                });
                healthMetrics.push(metric);
            }
        }

        console.log(`Created ${healthMetrics.length} health metrics`);

        // Create sample MR meetings
        const meetings = [];
        for (const mr of medicalReps) {
            // Create meetings with doctors in the same territory
            const territoryDoctors = doctors.filter(d =>
                d.clinic.city.toLowerCase().includes(mr.territory.toLowerCase())
            );

            for (const doctor of territoryDoctors) {
                const meeting = await MRMeetings.create({
                    mrId: mr._id,
                    doctorId: doctor._id,
                    requestedDate: new Date(),
                    proposedDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
                    proposedTime: `${10 + Math.floor(Math.random() * 6)}:00`,
                    purpose: 'Product presentation and discussion',
                    products: mr.productsHandled.slice(0, 1),
                    message: 'Would like to discuss our new cardiovascular products',
                    status: ['pending', 'approved', 'completed'][Math.floor(Math.random() * 3)]
                });
                meetings.push(meeting);
            }
        }

        console.log(`Created ${meetings.length} MR meetings`);

        console.log('Database seeded successfully!');
        console.log('\n=== Sample Login Credentials ===');
        console.log('Patient: john.doe@email.com / Password123!');
        console.log('Doctor: dr.smith@hospital.com / Password123!');
        console.log('MR: mr.jones@pharma.com / Password123!');
        console.log('Admin: admin@healthcare.com / Password123!');

    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

// Run seed
const runSeed = async () => {
    await connectDB();
    await seedDatabase();
    process.exit(0);
};

// Check if this file is being run directly
if (require.main === module) {
    runSeed();
}

module.exports = { seedDatabase, connectDB };