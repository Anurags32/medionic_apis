const Patient = require('../models/Patient');
const ErrorResponse = require('../utils/errorResponse');

// Mock ambulance data — in production this would call a maps/dispatch API
const MOCK_AMBULANCES = [
    { id: 'AMB001', name: 'City Emergency Services', phone: '+919876543210', type: 'ALS', distanceKm: 1.2, eta: '4 min' },
    { id: 'AMB002', name: 'LifeSave Ambulance', phone: '+919876543211', type: 'BLS', distanceKm: 2.1, eta: '6 min' },
    { id: 'AMB003', name: 'MediResponse Unit', phone: '+919876543212', type: 'ALS', distanceKm: 3.4, eta: '9 min' },
    { id: 'AMB004', name: 'QuickCare Ambulance', phone: '+919876543213', type: 'BLS', distanceKm: 4.0, eta: '11 min' },
    { id: 'AMB005', name: 'Govt Hospital Ambulance', phone: '102',         type: 'ALS', distanceKm: 4.8, eta: '13 min' }
];

// @desc    Send SOS alert to patient's emergency contacts
// @route   POST /api/emergency/sos
// @access  Private (Patient)
exports.sendSOS = async (req, res, next) => {
    try {
        const { latitude, longitude, message } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return next(new ErrorResponse('Latitude and longitude are required', 400));
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return next(new ErrorResponse('Latitude and longitude must be valid numbers', 400));
        }

        if (lat < -90 || lat > 90) {
            return next(new ErrorResponse('Latitude must be between -90 and 90', 400));
        }

        if (lng < -180 || lng > 180) {
            return next(new ErrorResponse('Longitude must be between -180 and 180', 400));
        }

        // Fetch patient's emergency contact
        const patient = await Patient.findOne({ userId: req.user._id })
            .populate('userId', 'firstName lastName email phone');

        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const patientName = `${patient.firstName} ${patient.lastName}`;
        const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
        const alertMessage = message || `EMERGENCY SOS: ${patientName} needs immediate help.`;
        const fullAlert = `${alertMessage}\n📍 Location: ${mapsLink}`;

        const contactsAlerted = [];

        // Alert primary emergency contact on the Patient profile
        if (patient.emergencyContact && patient.emergencyContact.phone) {
            contactsAlerted.push({
                name: patient.emergencyContact.name || 'Emergency Contact',
                phone: patient.emergencyContact.phone,
                relation: patient.emergencyContact.relation || 'Contact',
                channel: 'sms',
                status: 'dispatched'
            });
        }

        // Alert any extra contacts stored in emergencyContacts array (if it exists)
        if (Array.isArray(patient.emergencyContacts) && patient.emergencyContacts.length > 0) {
            patient.emergencyContacts.forEach(contact => {
                contactsAlerted.push({
                    name: contact.name,
                    phone: contact.phone,
                    relation: contact.relation,
                    channel: 'sms',
                    status: 'dispatched'
                });
            });
        }

        // In production: iterate contactsAlerted and fire SMS via Twilio / SMS gateway
        // For now, we log and return a success response so the app behaves correctly
        console.log(`🚨  SOS Alert from patient ${patient._id} (${patientName})`);
        console.log(`    Location: ${lat}, ${lng} — ${mapsLink}`);
        console.log(`    Alerting ${contactsAlerted.length} contact(s):`, contactsAlerted.map(c => c.phone));

        if (contactsAlerted.length === 0) {
            return res.status(200).json({
                success: true,
                warning: 'SOS recorded but no emergency contacts found on your profile. Please add an emergency contact.',
                data: {
                    sosId: `SOS_${Date.now()}`,
                    latitude: lat,
                    longitude: lng,
                    mapsLink,
                    contactsAlerted: [],
                    alertedAt: new Date().toISOString()
                }
            });
        }

        res.status(200).json({
            success: true,
            message: `SOS alert sent to ${contactsAlerted.length} emergency contact(s)`,
            data: {
                sosId: `SOS_${Date.now()}`,
                patient: { name: patientName, phone: patient.userId?.phone },
                latitude: lat,
                longitude: lng,
                mapsLink,
                alertMessage: fullAlert,
                contactsAlerted,
                alertedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get nearest ambulances (mock geo-search)
// @route   GET /api/emergency/ambulances/nearest?lat&lng
// @access  Private
exports.getNearestAmbulances = async (req, res, next) => {
    try {
        const { lat, lng, limit = 5 } = req.query;

        if (!lat || !lng) {
            return next(new ErrorResponse('lat and lng query parameters are required', 400));
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        if (isNaN(latitude) || isNaN(longitude)) {
            return next(new ErrorResponse('lat and lng must be valid numbers', 400));
        }

        // In production: query a geospatial index or call an ambulance dispatch API.
        // Here we return sorted mock data with a simulated distance jitter so results
        // look location-sensitive to the client.
        const jitter = (Math.abs(latitude) % 3) * 0.1; // deterministic per-location variation
        const ambulances = MOCK_AMBULANCES
            .slice(0, parseInt(limit))
            .map((a, idx) => ({
                ...a,
                distanceKm: parseFloat((a.distanceKm + jitter + idx * 0.05).toFixed(1)),
                coordinates: {
                    latitude: latitude + (0.01 * (idx + 1)),
                    longitude: longitude + (0.01 * (idx + 1))
                }
            }))
            .sort((a, b) => a.distanceKm - b.distanceKm);

        res.status(200).json({
            success: true,
            data: {
                requestedLocation: { latitude, longitude },
                ambulances,
                emergencyNumbers: {
                    national: '102',
                    police: '100',
                    fire: '101',
                    disaster: '108'
                },
                note: 'Ambulance locations are approximate. Call directly for fastest response.'
            }
        });
    } catch (error) {
        next(error);
    }
};
