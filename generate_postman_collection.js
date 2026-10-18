const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates Postman test script that captures JWT token and entity IDs into collection variables.
 */
function saveAuthScript(tokenVar) {
    return {
        listen: "test",
        script: {
            exec: [
                "if (pm.response.code === 200 || pm.response.code === 201) {",
                "    var res = pm.response.json();",
                "    var token = res.token || (res.data && (res.data.token || res.data.accessToken));",
                "    if (token) {",
                `        pm.collectionVariables.set("${tokenVar}", token);`,
                `        console.log("✅ Auto-saved ${tokenVar}:", token.substring(0, 15) + "...");`,
                "    }",
                "    if (res.data) {",
                "        if (res.data.patientId) { pm.collectionVariables.set('patientId', res.data.patientId); }",
                "        if (res.data.doctorId) { pm.collectionVariables.set('doctorId', res.data.doctorId); }",
                "        if (res.data.mrId) { pm.collectionVariables.set('mrId', res.data.mrId); }",
                "        if (res.data.userId) { pm.collectionVariables.set('userId', res.data.userId); }",
                "        if (res.data.user && res.data.user.branch_id) { pm.collectionVariables.set('branchId', res.data.user.branch_id); }",
                "        if (res.data.branch && (res.data.branch.id || res.data.branch._id)) { pm.collectionVariables.set('branchId', res.data.branch.id || res.data.branch._id); }",
                "        if (res.data.user && res.data.user.id) { pm.collectionVariables.set('pharmacyOwnerId', res.data.user.id); }",
                "    }",
                "}"
            ],
            type: "text/javascript"
        }
    };
}

/**
 * Creates Postman test script that searches response and automatically saves entity IDs.
 */
function saveIdScript(variableName, lookupKeys) {
    return {
        listen: "test",
        script: {
            exec: [
                "if (pm.response.code === 200 || pm.response.code === 201) {",
                "    var res = pm.response.json();",
                "    var targetId = null;",
                "    var keys = " + JSON.stringify(lookupKeys) + ";",
                "    function searchObj(obj) {",
                "        if (!obj || typeof obj !== 'object') return null;",
                "        for (var i = 0; i < keys.length; i++) {",
                "            if (obj[keys[i]]) return obj[keys[i]];",
                "        }",
                "        if (obj.data) return searchObj(obj.data);",
                "        if (obj.appointment) return searchObj(obj.appointment);",
                "        if (obj.prescription) return searchObj(obj.prescription);",
                "        if (obj.order) return searchObj(obj.order);",
                "        if (obj.medicine) return searchObj(obj.medicine);",
                "        if (obj.invoice) return searchObj(obj.invoice);",
                "        if (obj.customer) return searchObj(obj.customer);",
                "        if (obj.staff) return searchObj(obj.staff);",
                "        return null;",
                "    }",
                "    targetId = searchObj(res);",
                "    if (targetId) {",
                `        pm.collectionVariables.set("${variableName}", String(targetId));`,
                `        console.log("✅ Auto-saved ${variableName}:", targetId);`,
                "    }",
                "}"
            ],
            type: "text/javascript"
        }
    };
}

/**
 * Helper to construct Bearer Auth config.
 */
function authHeader(tokenVar = "patientToken") {
    return {
        type: "bearer",
        bearer: [
            {
                key: "token",
                value: `{{${tokenVar}}}`,
                type: "string"
            }
        ]
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE POSTMAN COLLECTION STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

const collection = {
    info: {
        _postman_id: "medionic-full-api-collection-v3",
        name: "Medionic HealthCare+ Complete & Production-Ready API Collection",
        description: "Official, comprehensive Postman Collection for Medionic HealthCare+ API ecosystem.\n\n✨ Features:\n- 100% Endpoints covered across Patient, Doctor, MR, Admin, Pharmacy (v1), AI Diagnostics, Payments & Telehealth.\n- Auto-token capturing for all roles upon login/registration.\n- Auto-ID capturing (appointmentId, prescriptionId, orderId, medicineId, invoiceId, branchId, etc.).\n- Pre-seeded ready-to-test 1-click accounts.\n- Environment/Collection variables pre-configured for instant zero-configuration testing.",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
        { key: "baseUrl", value: "http://localhost:5001", type: "string" },
        { key: "apiPrefixV1", value: "http://localhost:5001/api/v1", type: "string" },
        { key: "adminToken", value: "", type: "string" },
        { key: "doctorToken", value: "", type: "string" },
        { key: "patientToken", value: "", type: "string" },
        { key: "mrToken", value: "", type: "string" },
        { key: "pharmacyToken", value: "", type: "string" },
        { key: "adminSecretKey", value: "medionic-admin-secret-2026", type: "string" },
        { key: "doctorId", value: "65f1a2b3c4d5e6f7a8b9c0d1", type: "string" },
        { key: "patientId", value: "65f1a2b3c4d5e6f7a8b9c0d2", type: "string" },
        { key: "mrId", value: "65f1a2b3c4d5e6f7a8b9c0d3", type: "string" },
        { key: "pharmacyOwnerId", value: "65f1a2b3c4d5e6f7a8b9c0d4", type: "string" },
        { key: "appointmentId", value: "65f1a2b3c4d5e6f7a8b9c0d5", type: "string" },
        { key: "prescriptionId", value: "65f1a2b3c4d5e6f7a8b9c0d6", type: "string" },
        { key: "branchId", value: "65f1a2b3c4d5e6f7a8b9c0d7", type: "string" },
        { key: "medicineId", value: "65f1a2b3c4d5e6f7a8b9c0d8", type: "string" },
        { key: "invoiceId", value: "65f1a2b3c4d5e6f7a8b9c0d9", type: "string" },
        { key: "orderId", value: "65f1a2b3c4d5e6f7a8b9c0e0", type: "string" },
        { key: "staffId", value: "65f1a2b3c4d5e6f7a8b9c0e1", type: "string" },
        { key: "customerId", value: "65f1a2b3c4d5e6f7a8b9c0e2", type: "string" },
        { key: "chemistId", value: "65f1a2b3c4d5e6f7a8b9c0e3", type: "string" },
        { key: "tourPlanId", value: "65f1a2b3c4d5e6f7a8b9c0e4", type: "string" },
        { key: "labTestId", value: "65f1a2b3c4d5e6f7a8b9c0e5", type: "string" },
        { key: "callId", value: "call_sample_12345", type: "string" }
    ],
    item: []
};

// ─────────────────────────────────────────────────────────────────────────────
// 00. Health & System
// ─────────────────────────────────────────────────────────────────────────────
const healthFolder = {
    name: "00. Health & System Probes",
    item: [
        {
            name: "Health Check (Database & Server Status)",
            request: {
                method: "GET",
                header: [],
                url: {
                    raw: "{{baseUrl}}/api/health",
                    host: ["{{baseUrl}}"],
                    path: ["api", "health"]
                },
                description: "Verifies API server status, environment, MongoDB connectivity and request IDs."
            }
        },
        {
            name: "Readiness Check (Kubernetes/Cloud Probe)",
            request: {
                method: "GET",
                header: [],
                url: {
                    raw: "{{baseUrl}}/api/ready",
                    host: ["{{baseUrl}}"],
                    path: ["api", "ready"]
                },
                description: "Returns 200 if MongoDB is fully ready, 503 otherwise."
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 01. Authentication & Roles
// ─────────────────────────────────────────────────────────────────────────────
const authFolder = {
    name: "01. Authentication & Identity",
    item: [
        {
            name: "⚡ Instant 1-Click Logins (Pre-Seeded Data)",
            item: [
                {
                    name: "Login Pre-Seeded Patient (Aarav Gupta)",
                    event: [saveAuthScript("patientToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "aarav.gupta@gmail.com",
                                password: "Patient@1234"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/patient/login", host: ["{{baseUrl}}"], path: ["api", "auth", "patient", "login"] },
                        description: "Logs in with seed.js patient credentials and auto-saves {{patientToken}} and {{patientId}}."
                    }
                },
                {
                    name: "Login Pre-Seeded Doctor (Dr. Rajesh Sharma - Verified)",
                    event: [saveAuthScript("doctorToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "dr.sharma@hospital.com",
                                password: "Doctor@1234"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/doctor/login", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "login"] },
                        description: "Logs in with seed.js pre-verified doctor and auto-saves {{doctorToken}} and {{doctorId}}."
                    }
                },
                {
                    name: "Login Pre-Seeded Admin (Platform Admin)",
                    event: [saveAuthScript("adminToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "admin@healthcare.com",
                                password: "Admin@1234"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/login", host: ["{{baseUrl}}"], path: ["api", "admin", "login"] },
                        description: "Logs in with seed.js admin credentials and auto-saves {{adminToken}}."
                    }
                },
                {
                    name: "Login Pre-Seeded MR (Vikram Singh - Verified)",
                    event: [saveAuthScript("mrToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "vikram.singh@pharmamax.com",
                                password: "MRep@1234"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/mr/login", host: ["{{baseUrl}}"], path: ["api", "auth", "mr", "login"] },
                        description: "Logs in with seed.js pre-verified MR and auto-saves {{mrToken}} and {{mrId}}."
                    }
                }
            ]
        },
        {
            name: "Patient Auth Subsystem",
            item: [
                {
                    name: "Register Patient",
                    event: [saveAuthScript("patientToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                fullName: "Rahul Verma",
                                email: "patient@medionic.com",
                                password: "Password@123",
                                phone: "+919876543210",
                                gender: "male",
                                bloodGroup: "O+",
                                dob: "15/05/1995",
                                address: "221B Baker Street, Sector 4, New Delhi, Delhi, 110001"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/patient/register", host: ["{{baseUrl}}"], path: ["api", "auth", "patient", "register"] }
                    }
                },
                {
                    name: "Login Patient",
                    event: [saveAuthScript("patientToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "patient@medionic.com",
                                password: "Password@123"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/patient/login", host: ["{{baseUrl}}"], path: ["api", "auth", "patient", "login"] }
                    }
                }
            ]
        },
        {
            name: "Doctor Auth Subsystem",
            item: [
                {
                    name: "Register Doctor",
                    event: [saveAuthScript("doctorToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                fullName: "Dr. Ananya Sharma",
                                email: "doctor@medionic.com",
                                password: "Password@123",
                                phone: "+919876500001",
                                specialization: "Cardiology",
                                qualification: "MBBS, MD (Cardiology)",
                                yearsExperience: 8,
                                licenseNumber: "MCI-45892",
                                consultationFee: 800,
                                clinicName: "Medionic Heart Care Clinic",
                                clinicAddress: "12 Connaught Place, New Delhi, Delhi, 110001",
                                shift: {
                                    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                    startTime: "09:00",
                                    endTime: "17:00",
                                    slotDuration: 30
                                }
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/doctor/register", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "register"] },
                        description: "Registers Doctor in PENDING status. Admin must approve before login works."
                    }
                },
                {
                    name: "Login Doctor",
                    event: [saveAuthScript("doctorToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "doctor@medionic.com",
                                password: "Password@123"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/doctor/login", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "login"] }
                    }
                },
                {
                    name: "Get Doctor Profile (Auth Subsystem)",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/auth/doctor/profile", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "profile"] }
                    }
                },
                {
                    name: "Check Doctor Verification Status",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/auth/doctor/status", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "status"] }
                    }
                }
            ]
        },
        {
            name: "Medical Representative (MR) Auth Subsystem",
            item: [
                {
                    name: "Register MR",
                    event: [saveAuthScript("mrToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                fullName: "Vikram Malhotra",
                                email: "mr@medionic.com",
                                password: "Password@123",
                                phone: "+919876500002",
                                companyName: "Sun Pharma Healthcare Ltd",
                                territory: "North Delhi & NCR",
                                designation: "Senior Territory Executive",
                                employeeId: "SP-88921"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/mr/register", host: ["{{baseUrl}}"], path: ["api", "auth", "mr", "register"] }
                    }
                },
                {
                    name: "Login MR",
                    event: [saveAuthScript("mrToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "mr@medionic.com",
                                password: "Password@123"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/mr/login", host: ["{{baseUrl}}"], path: ["api", "auth", "mr", "login"] }
                    }
                },
                {
                    name: "Get MR Profile (Auth Subsystem)",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/auth/mr/profile", host: ["{{baseUrl}}"], path: ["api", "auth", "mr", "profile"] }
                    }
                },
                {
                    name: "Check MR Verification Status",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/auth/mr/status", host: ["{{baseUrl}}"], path: ["api", "auth", "mr", "status"] }
                    }
                }
            ]
        },
        {
            name: "Core Unified Auth & Account Lifecycle",
            item: [
                {
                    name: "Unified Register (/api/auth/register)",
                    event: [saveAuthScript("patientToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "coreuser@medionic.com",
                                password: "Password@123",
                                role: "patient"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/register", host: ["{{baseUrl}}"], path: ["api", "auth", "register"] }
                    }
                },
                {
                    name: "Unified Login (/api/auth/login)",
                    event: [saveAuthScript("patientToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "coreuser@medionic.com",
                                password: "Password@123"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/login", host: ["{{baseUrl}}"], path: ["api", "auth", "login"] }
                    }
                },
                {
                    name: "Get Current User (Me)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/auth/me", host: ["{{baseUrl}}"], path: ["api", "auth", "me"] }
                    }
                },
                {
                    name: "Update Current User (Me)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                fullName: "Rahul Verma (Updated)",
                                phone: "+919876543219"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/me", host: ["{{baseUrl}}"], path: ["api", "auth", "me"] }
                    }
                },
                {
                    name: "Refresh JWT Token",
                    event: [saveAuthScript("patientToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                refreshToken: "sample-refresh-token"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/refresh-token", host: ["{{baseUrl}}"], path: ["api", "auth", "refresh-token"] }
                    }
                },
                {
                    name: "Forgot Password",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "patient@medionic.com"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/forgot-password", host: ["{{baseUrl}}"], path: ["api", "auth", "forgot-password"] }
                    }
                },
                {
                    name: "Reset Password",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                resetToken: "sample-reset-token",
                                newPassword: "NewPassword@123"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/reset-password", host: ["{{baseUrl}}"], path: ["api", "auth", "reset-password"] }
                    }
                },
                {
                    name: "Complete Patient Profile",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                firstName: "Rahul",
                                lastName: "Verma",
                                dob: "1995-05-15",
                                gender: "male",
                                bloodGroup: "O+",
                                address: {
                                    street: "221B Baker Street",
                                    city: "New Delhi",
                                    state: "Delhi",
                                    zip: "110001"
                                },
                                emergencyContact: {
                                    name: "Suresh Verma",
                                    phone: "+919876543299",
                                    relation: "Father"
                                }
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/complete-profile/patient", host: ["{{baseUrl}}"], path: ["api", "auth", "complete-profile", "patient"] }
                    }
                },
                {
                    name: "Complete Doctor Profile",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                firstName: "Ananya",
                                lastName: "Sharma",
                                specialization: "Cardiology",
                                qualification: "MBBS, MD",
                                licenseNumber: "MCI-45892",
                                yearsExperience: 8,
                                consultationFee: 800
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/complete-profile/doctor", host: ["{{baseUrl}}"], path: ["api", "auth", "complete-profile", "doctor"] }
                    }
                },
                {
                    name: "Complete MR Profile",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                firstName: "Vikram",
                                lastName: "Malhotra",
                                companyName: "Sun Pharma Healthcare Ltd",
                                territory: "North Delhi & NCR",
                                designation: "Senior Territory Executive",
                                employeeId: "SP-88921"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/complete-profile/mr", host: ["{{baseUrl}}"], path: ["api", "auth", "complete-profile", "mr"] }
                    }
                },
                {
                    name: "Logout",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/auth/logout", host: ["{{baseUrl}}"], path: ["api", "auth", "logout"] }
                    }
                }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 02. Admin Panel
// ─────────────────────────────────────────────────────────────────────────────
const adminFolder = {
    name: "02. Admin Panel",
    item: [
        {
            name: "Admin Self-Registration (Secret Key Required)",
            event: [saveAuthScript("adminToken")],
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        fullName: "Super Admin",
                        email: "admin@medionic.com",
                        password: "Admin@1234Secure",
                        secretKey: "{{adminSecretKey}}"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/admin/register", host: ["{{baseUrl}}"], path: ["api", "admin", "register"] },
                description: "Registers initial Admin. Requires ADMIN_REGISTRATION_SECRET defined in .env"
            }
        },
        {
            name: "Admin Login",
            event: [saveAuthScript("adminToken")],
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        email: "admin@medionic.com",
                        password: "Admin@1234Secure"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/admin/login", host: ["{{baseUrl}}"], path: ["api", "admin", "login"] }
            }
        },
        {
            name: "Admin Login (Core Auth Endpoint)",
            event: [saveAuthScript("adminToken")],
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        email: "admin@healthcare.com",
                        password: "Admin@1234"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/auth/admin/login", host: ["{{baseUrl}}"], path: ["api", "auth", "admin", "login"] }
            }
        },
        {
            name: "Admin Dashboard Stats",
            request: {
                auth: authHeader("adminToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/admin/dashboard", host: ["{{baseUrl}}"], path: ["api", "admin", "dashboard"] }
            }
        },
        {
            name: "Doctor Approvals & Governance",
            item: [
                {
                    name: "Get All Doctors (With Filtering & Pagination)",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/doctors?status=pending&page=1&limit=20",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "doctors"],
                            query: [
                                { key: "status", value: "pending" },
                                { key: "page", value: "1" },
                                { key: "limit", value: "20" }
                            ]
                        }
                    }
                },
                {
                    name: "Get Doctor Profile by ID",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/doctors/{{doctorId}}", host: ["{{baseUrl}}"], path: ["api", "admin", "doctors", "{{doctorId}}"] }
                    }
                },
                {
                    name: "Approve Doctor",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/doctors/{{doctorId}}/approve", host: ["{{baseUrl}}"], path: ["api", "admin", "doctors", "{{doctorId}}", "approve"] }
                    }
                },
                {
                    name: "Reject Doctor",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Invalid medical council credentials" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/doctors/{{doctorId}}/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "doctors", "{{doctorId}}", "reject"] }
                    }
                },
                {
                    name: "Verify Doctor",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/doctors/{{doctorId}}/verify", host: ["{{baseUrl}}"], path: ["api", "admin", "doctors", "{{doctorId}}", "verify"] }
                    }
                },
                {
                    name: "Set Doctor Verification Status (Direct)",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "verified" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/doctor/{{doctorId}}/verify-status", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "{{doctorId}}", "verify-status"] }
                    }
                }
            ]
        },
        {
            name: "Medical Representative (MR) Management",
            item: [
                {
                    name: "Get All MRs",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/mr?status=pending&page=1&limit=20",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "mr"],
                            query: [
                                { key: "status", value: "pending" },
                                { key: "page", value: "1" },
                                { key: "limit", value: "20" }
                            ]
                        }
                    }
                },
                {
                    name: "Get MR Profile by ID",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/mr/{{mrId}}", host: ["{{baseUrl}}"], path: ["api", "admin", "mr", "{{mrId}}"] }
                    }
                },
                {
                    name: "Approve MR",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/mr/{{mrId}}/approve", host: ["{{baseUrl}}"], path: ["api", "admin", "mr", "{{mrId}}", "approve"] }
                    }
                },
                {
                    name: "Reject MR",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Company authorization letter verification failed" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/mr/{{mrId}}/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "mr", "{{mrId}}", "reject"] }
                    }
                },
                {
                    name: "Verify MR Status (Direct)",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "verified" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/mr/{{mrId}}/verify-status", host: ["{{baseUrl}}"], path: ["api", "auth", "mr", "{{mrId}}", "verify-status"] }
                    }
                }
            ]
        },
        {
            name: "Patient Oversight",
            item: [
                {
                    name: "Get All Patients",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/patients?page=1&limit=20",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "patients"],
                            query: [{ key: "page", value: "1" }, { key: "limit", value: "20" }]
                        }
                    }
                },
                {
                    name: "Get Patient Profile by ID",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/patients/{{patientId}}", host: ["{{baseUrl}}"], path: ["api", "admin", "patients", "{{patientId}}"] }
                    }
                }
            ]
        },
        {
            name: "Pharmacy Owner Approvals",
            item: [
                {
                    name: "Get All Pharmacy Owners",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/pharmacy-owners?approval_status=pending&page=1&limit=20",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "pharmacy-owners"],
                            query: [
                                { key: "approval_status", value: "pending" },
                                { key: "page", value: "1" },
                                { key: "limit", value: "20" }
                            ]
                        }
                    }
                },
                {
                    name: "Get Pharmacy Owner Profile by ID",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/pharmacy-owners/{{pharmacyOwnerId}}", host: ["{{baseUrl}}"], path: ["api", "admin", "pharmacy-owners", "{{pharmacyOwnerId}}"] }
                    }
                },
                {
                    name: "Approve Pharmacy Owner",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ remarks: "Drug License and GSTIN verified successfully" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/pharmacy-owners/{{pharmacyOwnerId}}/approve", host: ["{{baseUrl}}"], path: ["api", "admin", "pharmacy-owners", "{{pharmacyOwnerId}}", "approve"] }
                    }
                },
                {
                    name: "Reject Pharmacy Owner",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Expired Drug License document" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/pharmacy-owners/{{pharmacyOwnerId}}/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "pharmacy-owners", "{{pharmacyOwnerId}}", "reject"] }
                    }
                }
            ]
        },
        {
            name: "User Account Moderation",
            item: [
                {
                    name: "Get All Registered Users",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/users?role=patient&status=active&page=1&limit=20",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "users"],
                            query: [
                                { key: "role", value: "patient" },
                                { key: "status", value: "active" },
                                { key: "page", value: "1" },
                                { key: "limit", value: "20" }
                            ]
                        }
                    }
                },
                {
                    name: "Suspend / Reactivate User",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                reason: "Policy violation regarding automated booking scripts",
                                suspend: true
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/users/{{patientId}}/suspend", host: ["{{baseUrl}}"], path: ["api", "admin", "users", "{{patientId}}", "suspend"] }
                    }
                }
            ]
        },
        {
            name: "MR Expense Approvals",
            item: [
                {
                    name: "Get Pending Expense Approvals",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/expenses/pending-approvals", host: ["{{baseUrl}}"], path: ["api", "admin", "expenses", "pending-approvals"] }
                    }
                },
                {
                    name: "Approve MR Expense",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ approvedAmount: 1200, notes: "Approved per policy" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/expenses/{{expenseId}}/approve", host: ["{{baseUrl}}"], path: ["api", "admin", "expenses", "{{expenseId}}", "approve"] }
                    }
                },
                {
                    name: "Reject MR Expense",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Missing supporting travel receipts" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/expenses/{{expenseId}}/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "expenses", "{{expenseId}}", "reject"] }
                    }
                }
            ]
        },
        {
            name: "Financials, Transactions & Revenue",
            item: [
                {
                    name: "Get Payments Dashboard Stats",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/payments/dashboard", host: ["{{baseUrl}}"], path: ["api", "admin", "payments", "dashboard"] }
                    }
                },
                {
                    name: "Get All Transactions",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/payments/transactions?page=1&limit=25",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "payments", "transactions"],
                            query: [{ key: "page", value: "1" }, { key: "limit", value: "25" }]
                        }
                    }
                },
                {
                    name: "Get Doctor Appointment Payments",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/payments/appointments", host: ["{{baseUrl}}"], path: ["api", "admin", "payments", "appointments"] }
                    }
                },
                {
                    name: "Get Pharmacy Invoices (POS)",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/payments/pharmacy-invoices", host: ["{{baseUrl}}"], path: ["api", "admin", "payments", "pharmacy-invoices"] }
                    }
                },
                {
                    name: "Get Pharmacy Online Orders",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/payments/pharmacy-orders", host: ["{{baseUrl}}"], path: ["api", "admin", "payments", "pharmacy-orders"] }
                    }
                },
                {
                    name: "Get All MR Expenses Report",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/payments/mr-expenses", host: ["{{baseUrl}}"], path: ["api", "admin", "payments", "mr-expenses"] }
                    }
                }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 03. Doctor Portal
// ─────────────────────────────────────────────────────────────────────────────
const doctorFolder = {
    name: "03. Doctor Portal",
    item: [
        {
            name: "Doctor Profile & Schedule",
            item: [
                {
                    name: "Get Doctor Profile",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/profile", host: ["{{baseUrl}}"], path: ["api", "doctors", "profile"] }
                    }
                },
                {
                    name: "Update Doctor Profile",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                consultationFee: 1000,
                                about: "Senior Cardiologist & Interventional Heart Specialist",
                                languages: ["English", "Hindi", "Punjabi"]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/profile", host: ["{{baseUrl}}"], path: ["api", "doctors", "profile"] }
                    }
                },
                {
                    name: "Update Doctor Availability Status",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "available" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/status", host: ["{{baseUrl}}"], path: ["api", "doctors", "status"] }
                    }
                },
                {
                    name: "Update Online Status (Live Presence)",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ isOnline: true }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/online-status", host: ["{{baseUrl}}"], path: ["api", "doctors", "online-status"] }
                    }
                },
                {
                    name: "Get Doctor Schedule",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/schedule", host: ["{{baseUrl}}"], path: ["api", "doctors", "schedule"] }
                    }
                },
                {
                    name: "Update Doctor Schedule",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                                startTime: "10:00",
                                endTime: "18:00",
                                slotDuration: 20
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/schedule", host: ["{{baseUrl}}"], path: ["api", "doctors", "schedule"] }
                    }
                },
                {
                    name: "Submit Verification Documents",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                registrationCouncil: "Medical Council of India",
                                medicalCouncilNumber: "MCI-45892",
                                documents: [
                                    { documentType: "license", documentUrl: "/uploads/license.pdf" }
                                ]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/profile/verify", host: ["{{baseUrl}}"], path: ["api", "doctors", "profile", "verify"] }
                    }
                }
            ]
        },
        {
            name: "Appointments & Patients",
            item: [
                {
                    name: "Doctor Dashboard",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/dashboard", host: ["{{baseUrl}}"], path: ["api", "doctors", "dashboard"] }
                    }
                },
                {
                    name: "Get Appointments",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/doctors/appointments?status=confirmed&date=today",
                            host: ["{{baseUrl}}"],
                            path: ["api", "doctors", "appointments"],
                            query: [
                                { key: "status", value: "confirmed" },
                                { key: "date", value: "today" }
                            ]
                        }
                    }
                },
                {
                    name: "Get Appointment Details",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/appointments/{{appointmentId}}", host: ["{{baseUrl}}"], path: ["api", "doctors", "appointments", "{{appointmentId}}"] }
                    }
                },
                {
                    name: "Confirm Appointment",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/appointments/{{appointmentId}}/confirm", host: ["{{baseUrl}}"], path: ["api", "doctors", "appointments", "{{appointmentId}}", "confirm"] }
                    }
                },
                {
                    name: "Complete Appointment",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                clinicalNotes: "Patient examined. Vitals normal. Prescribed hypertension medication.",
                                diagnosis: "Stage 1 Hypertension"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/appointments/{{appointmentId}}/complete", host: ["{{baseUrl}}"], path: ["api", "doctors", "appointments", "{{appointmentId}}", "complete"] }
                    }
                },
                {
                    name: "Cancel Appointment (Doctor)",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Emergency surgery schedule conflict" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/appointments/{{appointmentId}}/cancel", host: ["{{baseUrl}}"], path: ["api", "doctors", "appointments", "{{appointmentId}}", "cancel"] }
                    }
                },
                {
                    name: "Get My Patients List",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/patients", host: ["{{baseUrl}}"], path: ["api", "doctors", "patients"] }
                    }
                },
                {
                    name: "Get Patient Clinical Profile",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/patients/{{patientId}}", host: ["{{baseUrl}}"], path: ["api", "doctors", "patients", "{{patientId}}"] }
                    }
                },
                {
                    name: "Get Patient Medical History",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/patients/{{patientId}}/history", host: ["{{baseUrl}}"], path: ["api", "doctors", "patients", "{{patientId}}", "history"] }
                    }
                }
            ]
        },
        {
            name: "Prescriptions & MR Meetings",
            item: [
                {
                    name: "Create Prescription",
                    event: [saveIdScript("prescriptionId", ["_id", "id", "prescriptionId"])],
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                patientId: "{{patientId}}",
                                appointmentId: "{{appointmentId}}",
                                diagnosis: "Hypertension Stage 1",
                                medicines: [
                                    {
                                        name: "Amlodipine 5mg",
                                        dosage: "5mg",
                                        timing: "OD",
                                        frequency: "Once daily (Morning)",
                                        duration: "30 days",
                                        instructions: "Take after breakfast",
                                        withFood: true
                                    }
                                ],
                                instructions: ["Reduce salt intake", "Daily 30 min morning walk"],
                                followUpDate: "2026-11-15",
                                notes: "Monitor BP every morning"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/prescriptions", host: ["{{baseUrl}}"], path: ["api", "doctors", "prescriptions"] },
                        description: "Validates schema and auto-saves generated {{prescriptionId}}."
                    }
                },
                {
                    name: "Get All Prescriptions Written",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/prescriptions", host: ["{{baseUrl}}"], path: ["api", "doctors", "prescriptions"] }
                    }
                },
                {
                    name: "Get MR Meeting Requests",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/mr-meetings", host: ["{{baseUrl}}"], path: ["api", "doctors", "mr-meetings"] }
                    }
                },
                {
                    name: "Approve MR Meeting",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ slotTime: "14:30" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/mr-meetings/{{meetingId}}/approve", host: ["{{baseUrl}}"], path: ["api", "doctors", "mr-meetings", "{{meetingId}}", "approve"] }
                    }
                },
                {
                    name: "Reject MR Meeting",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "OPD clinic fully booked this week" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/mr-meetings/{{meetingId}}/reject", host: ["{{baseUrl}}"], path: ["api", "doctors", "mr-meetings", "{{meetingId}}", "reject"] }
                    }
                }
            ]
        },
        {
            name: "Earnings, Withdrawals & Analytics",
            item: [
                {
                    name: "Get Doctor Overall Analytics",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/analytics", host: ["{{baseUrl}}"], path: ["api", "doctors", "analytics"] }
                    }
                },
                {
                    name: "Get Revenue Analytics",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/doctors/analytics/revenue?period=monthly",
                            host: ["{{baseUrl}}"],
                            path: ["api", "doctors", "analytics", "revenue"],
                            query: [{ key: "period", value: "monthly" }]
                        }
                    }
                },
                {
                    name: "Get Rating Analytics",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/analytics/ratings", host: ["{{baseUrl}}"], path: ["api", "doctors", "analytics", "ratings"] }
                    }
                },
                {
                    name: "Get Appointment Trends",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/analytics/appointments", host: ["{{baseUrl}}"], path: ["api", "doctors", "analytics", "appointments"] }
                    }
                },
                {
                    name: "Get Earnings Summary",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/earnings", host: ["{{baseUrl}}"], path: ["api", "doctors", "earnings"] }
                    }
                },
                {
                    name: "Request Earnings Withdrawal",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                amount: 5000,
                                bankDetails: {
                                    accountNumber: "123456789012",
                                    ifscCode: "HDFC0001234",
                                    accountHolderName: "Dr. Ananya Sharma"
                                }
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/earnings/withdraw", host: ["{{baseUrl}}"], path: ["api", "doctors", "earnings", "withdraw"] }
                    }
                },
                {
                    name: "Get Earnings History",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/earnings/history", host: ["{{baseUrl}}"], path: ["api", "doctors", "earnings", "history"] }
                    }
                }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 04. Patient Portal
// ─────────────────────────────────────────────────────────────────────────────
const patientFolder = {
    name: "04. Patient Portal",
    item: [
        {
            name: "Profile & Dashboard",
            item: [
                {
                    name: "Patient Dashboard Stats",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/dashboard", host: ["{{baseUrl}}"], path: ["api", "patients", "dashboard"] }
                    }
                },
                {
                    name: "Get Patient Profile",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/profile", host: ["{{baseUrl}}"], path: ["api", "patients", "profile"] }
                    }
                },
                {
                    name: "Update Patient Profile",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                bloodGroup: "O+",
                                emergencyContact: {
                                    name: "Sunita Verma",
                                    phone: "+919876500000",
                                    relation: "Mother"
                                },
                                allergies: ["Penicillin", "Sulfa drugs"]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/profile", host: ["{{baseUrl}}"], path: ["api", "patients", "profile"] }
                    }
                },
                {
                    name: "Get Family Members",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/family-members", host: ["{{baseUrl}}"], path: ["api", "patients", "family-members"] }
                    }
                },
                {
                    name: "Add Family Member",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                fullName: "Sneha Verma",
                                relation: "Sister",
                                gender: "female",
                                dob: "1998-08-20"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/family-members", host: ["{{baseUrl}}"], path: ["api", "patients", "family-members"] }
                    }
                }
            ]
        },
        {
            name: "Find Doctors & Appointments",
            item: [
                {
                    name: "Search Doctors (Specialty, Location, Pricing)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/patients/doctors?specialization=Cardiology&page=1&limit=10",
                            host: ["{{baseUrl}}"],
                            path: ["api", "patients", "doctors"],
                            query: [
                                { key: "specialization", value: "Cardiology" },
                                { key: "page", value: "1" },
                                { key: "limit", value: "10" }
                            ]
                        }
                    }
                },
                {
                    name: "Get Doctor Details by ID",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/doctors/{{doctorId}}", host: ["{{baseUrl}}"], path: ["api", "patients", "doctors", "{{doctorId}}"] }
                    }
                },
                {
                    name: "Get Doctor Available Slots",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/patients/doctors/{{doctorId}}/available-slots?date=2026-10-25",
                            host: ["{{baseUrl}}"],
                            path: ["api", "patients", "doctors", "{{doctorId}}", "available-slots"],
                            query: [{ key: "date", value: "2026-10-25" }]
                        }
                    }
                },
                {
                    name: "Book Appointment (Joi Schema Validated)",
                    event: [saveIdScript("appointmentId", ["_id", "id", "appointmentId"])],
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                doctorId: "{{doctorId}}",
                                appointmentDate: "2026-10-25",
                                appointmentTime: "10:30",
                                consultationType: "clinic",
                                symptoms: "Routine cardiac checkup and BP monitoring"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments"] },
                        description: "Complies with Joi validation schema (HH:MM time format, clinic/video/chat consultationType) and auto-saves {{appointmentId}}."
                    }
                },
                {
                    name: "Get My Appointments",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/appointments", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments"] }
                    }
                },
                {
                    name: "Get Appointment Details",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}"] }
                    }
                },
                {
                    name: "Reschedule Appointment",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                appointmentDate: "2026-10-28",
                                appointmentTime: "11:00",
                                reason: "Office schedule shift"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/reschedule", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "reschedule"] }
                    }
                },
                {
                    name: "Cancel Appointment",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Patient had personal emergency" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/cancel", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "cancel"] }
                    }
                },
                {
                    name: "Pay for Appointment (Mark Paid)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                paymentMethod: "razorpay",
                                paymentId: "pay_sample_12345"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/pay", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "pay"] }
                    }
                },
                {
                    name: "Get Consultation Session Info",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/consultation-session", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "consultation-session"] }
                    }
                },
                {
                    name: "Rate Completed Appointment",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                rating: 5,
                                review: "Extremely attentive and thorough diagnosis. Highly recommended!"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/rate", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "rate"] }
                    }
                }
            ]
        },
        {
            name: "Prescriptions & Medical Records",
            item: [
                {
                    name: "Get All My Prescriptions",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/prescriptions", host: ["{{baseUrl}}"], path: ["api", "patients", "prescriptions"] }
                    }
                },
                {
                    name: "Get Prescription Details",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/prescriptions/{{prescriptionId}}", host: ["{{baseUrl}}"], path: ["api", "patients", "prescriptions", "{{prescriptionId}}"] }
                    }
                },
                {
                    name: "Download Prescription PDF",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/prescriptions/{{prescriptionId}}/download", host: ["{{baseUrl}}"], path: ["api", "patients", "prescriptions", "{{prescriptionId}}", "download"] }
                    }
                },
                {
                    name: "Get Patient Medical Records",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/medical-records", host: ["{{baseUrl}}"], path: ["api", "patients", "medical-records"] }
                    }
                },
                {
                    name: "Upload Medical Record (Multipart)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [],
                        body: {
                            mode: "formdata",
                            formdata: [
                                { key: "title", value: "Annual Blood Test Report 2026", type: "text" },
                                { key: "recordType", value: "lab_report", type: "text" },
                                { key: "file", type: "file", src: "" }
                            ]
                        },
                        url: { raw: "{{baseUrl}}/api/patients/medical-records", host: ["{{baseUrl}}"], path: ["api", "patients", "medical-records"] }
                    }
                }
            ]
        },
        {
            name: "Health Tracking & Emergency Contacts",
            item: [
                {
                    name: "Get Health Metrics History",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/health-tracking", host: ["{{baseUrl}}"], path: ["api", "patients", "health-tracking"] }
                    }
                },
                {
                    name: "Log Health Metric (Vitals / Blood Pressure / Sugar)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                metricType: "blood_pressure",
                                value: { systolic: 120, diastolic: 80 },
                                unit: "mmHg",
                                measuredAt: new Date().toISOString()
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/health-tracking", host: ["{{baseUrl}}"], path: ["api", "patients", "health-tracking"] }
                    }
                },
                {
                    name: "Get Health Statistics & Trends",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/health-tracking/statistics", host: ["{{baseUrl}}"], path: ["api", "patients", "health-tracking", "statistics"] }
                    }
                },
                {
                    name: "Get Emergency Contacts",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/emergency-contacts", host: ["{{baseUrl}}"], path: ["api", "patients", "emergency-contacts"] }
                    }
                },
                {
                    name: "Add Emergency Contact",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Ramesh Verma",
                                phone: "+919876543290",
                                relation: "Brother"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/emergency-contacts", host: ["{{baseUrl}}"], path: ["api", "patients", "emergency-contacts"] }
                    }
                }
            ]
        },
        {
            name: "Pharmacy Ordering (Patient Subsystem)",
            item: [
                {
                    name: "Get Patient Pharmacy Orders",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/pharmacy-orders", host: ["{{baseUrl}}"], path: ["api", "patients", "pharmacy-orders"] }
                    }
                },
                {
                    name: "Create Pharmacy Order from Prescription",
                    event: [saveIdScript("orderId", ["_id", "id", "orderId"])],
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                prescriptionId: "{{prescriptionId}}",
                                deliveryAddress: "221B Baker Street, Sector 4, New Delhi",
                                paymentMethod: "cash_on_delivery"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/pharmacy-orders", host: ["{{baseUrl}}"], path: ["api", "patients", "pharmacy-orders"] }
                    }
                }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 05. Medical Representative (MR) Portal
// ─────────────────────────────────────────────────────────────────────────────
const mrFolder = {
    name: "05. Medical Representative (MR) Portal",
    item: [
        {
            name: "MR Profile & Doctors Directory",
            item: [
                {
                    name: "Get MR Profile",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/profile", host: ["{{baseUrl}}"], path: ["api", "mr", "profile"] }
                    }
                },
                {
                    name: "Update MR Profile",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                territory: "South Delhi & Gurgaon",
                                designation: "Area Business Manager"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/profile", host: ["{{baseUrl}}"], path: ["api", "mr", "profile"] }
                    }
                },
                {
                    name: "Search Doctors in Territory",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/mr/doctors?specialization=Cardiology",
                            host: ["{{baseUrl}}"],
                            path: ["api", "mr", "doctors"],
                            query: [{ key: "specialization", value: "Cardiology" }]
                        }
                    }
                },
                {
                    name: "Get Doctor Details (MR View)",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/doctors/{{doctorId}}", host: ["{{baseUrl}}"], path: ["api", "mr", "doctors", "{{doctorId}}"] }
                    }
                }
            ]
        },
        {
            name: "Doctor Meeting Requests & Tour Plans",
            item: [
                {
                    name: "Request Meeting with Doctor",
                    event: [saveIdScript("meetingId", ["_id", "id", "meetingId"])],
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                doctorId: "{{doctorId}}",
                                proposedDate: "2026-10-22",
                                proposedTime: "14:00",
                                agenda: "Introduction of new cardiac formulation (Atorvastatin + Aspirin combination)",
                                sampleProducts: ["Atorvastatin 20mg", "Rosuvastatin 10mg"]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/meeting-requests", host: ["{{baseUrl}}"], path: ["api", "mr", "meeting-requests"] }
                    }
                },
                {
                    name: "Get All Meeting Requests",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/meeting-requests", host: ["{{baseUrl}}"], path: ["api", "mr", "meeting-requests"] }
                    }
                },
                {
                    name: "Get Visit Plan",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/visit-plan", host: ["{{baseUrl}}"], path: ["api", "mr", "visit-plan"] }
                    }
                },
                {
                    name: "Get Tour Plan",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/tour-plan", host: ["{{baseUrl}}"], path: ["api", "mr", "tour-plan"] }
                    }
                },
                {
                    name: "Create Monthly Tour Plan (TP)",
                    event: [saveIdScript("tourPlanId", ["_id", "id", "tourPlanId"])],
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                month: "October",
                                year: 2026,
                                routes: [
                                    { date: "2026-10-20", area: "Connaught Place", targetDoctors: 6, targetChemists: 4 },
                                    { date: "2026-10-21", area: "Karol Bagh", targetDoctors: 8, targetChemists: 5 }
                                ]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/tour-plan", host: ["{{baseUrl}}"], path: ["api", "mr", "tour-plan"] }
                    }
                },
                {
                    name: "Get Tour Plan Weekly Breakdown",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/tour-plan/{{tourPlanId}}/weekly", host: ["{{baseUrl}}"], path: ["api", "mr", "tour-plan", "{{tourPlanId}}", "weekly"] }
                    }
                }
            ]
        },
        {
            name: "DCR (Daily Call Reports) & Samples",
            item: [
                {
                    name: "Get DCR List",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/dcr", host: ["{{baseUrl}}"], path: ["api", "mr", "dcr"] }
                    }
                },
                {
                    name: "Submit Daily Call Report (DCR)",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                date: "2026-10-20",
                                area: "Connaught Place",
                                doctorVisits: [
                                    {
                                        doctorId: "{{doctorId}}",
                                        time: "14:30",
                                        productsDiscussed: ["Atorvastatin 20mg"],
                                        feedback: "Doctor showed keen interest in prescribing.",
                                        samplesGiven: 2
                                    }
                                ],
                                chemistVisits: [
                                    {
                                        chemistName: "Gupta Medical Store",
                                        pobAmount: 15000,
                                        feedback: "Stock running low on 20mg formulation"
                                    }
                                ]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/dcr", host: ["{{baseUrl}}"], path: ["api", "mr", "dcr"] }
                    }
                },
                {
                    name: "Get Sample Inventory",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/samples", host: ["{{baseUrl}}"], path: ["api", "mr", "samples"] }
                    }
                },
                {
                    name: "Distribute Samples to Doctor",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                doctorId: "{{doctorId}}",
                                samples: [
                                    { productName: "Atorvastatin 20mg", quantity: 5, batchNumber: "ATV-2026-99" }
                                ]
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/samples/distribute", host: ["{{baseUrl}}"], path: ["api", "mr", "samples", "distribute"] }
                    }
                }
            ]
        },
        {
            name: "Chemist Directory & Field Expenses",
            item: [
                {
                    name: "Get Chemists in Territory",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/chemists", host: ["{{baseUrl}}"], path: ["api", "mr", "chemists"] }
                    }
                },
                {
                    name: "Add New Chemist",
                    event: [saveIdScript("chemistId", ["_id", "id", "chemistId"])],
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                storeName: "Capital Chemist & Druggist",
                                contactPerson: "Satish Bansal",
                                phone: "9876543000",
                                address: "Shop 12, Main Market, CP, New Delhi"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/chemists", host: ["{{baseUrl}}"], path: ["api", "mr", "chemists"] }
                    }
                },
                {
                    name: "Update Chemist Details",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                phone: "9876543999"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/chemists/{{chemistId}}", host: ["{{baseUrl}}"], path: ["api", "mr", "chemists", "{{chemistId}}"] }
                    }
                },
                {
                    name: "Get MR Field Expenses",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/expenses", host: ["{{baseUrl}}"], path: ["api", "mr", "expenses"] }
                    }
                },
                {
                    name: "Log Field Expense",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                date: "2026-10-20",
                                category: "travel",
                                amount: 850,
                                description: "Cab travel across CP and Karol Bagh territory",
                                receiptUrl: "/uploads/receipt_oct20.jpg"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/expenses", host: ["{{baseUrl}}"], path: ["api", "mr", "expenses"] }
                    }
                },
                {
                    name: "Get Territory Analytics",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/analytics", host: ["{{baseUrl}}"], path: ["api", "mr", "analytics"] }
                    }
                }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 06. Payments & Razorpay Gateway
// ─────────────────────────────────────────────────────────────────────────────
const paymentsFolder = {
    name: "06. Payments & Razorpay Gateway",
    item: [
        {
            name: "Create Payment Order (Authenticated Patient)",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        amount: 800,
                        currency: "INR",
                        receipt: "rcpt_appt_101",
                        notes: { appointmentId: "{{appointmentId}}" }
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/payments/create-order", host: ["{{baseUrl}}"], path: ["api", "payments", "create-order"] }
            }
        },
        {
            name: "Direct Create Order (/api/create-order)",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        amount: 500,
                        currency: "INR",
                        receipt: "rcpt_direct_202"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/create-order", host: ["{{baseUrl}}"], path: ["api", "create-order"] }
            }
        },
        {
            name: "Direct Verify Payment (/api/verify-payment)",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        razorpay_order_id: "order_mock_12345",
                        razorpay_payment_id: "pay_mock_98765",
                        razorpay_signature: "mock_signature_hash"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/verify-payment", host: ["{{baseUrl}}"], path: ["api", "verify-payment"] }
            }
        },
        {
            name: "Payments Verify Payment (/api/payments/verify-payment)",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        razorpay_order_id: "order_mock_12345",
                        razorpay_payment_id: "pay_mock_98765",
                        razorpay_signature: "mock_signature_hash"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/payments/verify-payment", host: ["{{baseUrl}}"], path: ["api", "payments", "verify-payment"] }
            }
        },
        {
            name: "Payment Webhook Simulation (Public/Razorpay)",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        event: "payment.captured",
                        payload: {
                            payment: {
                                entity: {
                                    id: "pay_sample_123",
                                    amount: 80000,
                                    currency: "INR",
                                    status: "captured",
                                    order_id: "order_sample_456"
                                }
                            }
                        }
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/payments/webhook", host: ["{{baseUrl}}"], path: ["api", "payments", "webhook"] }
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 07. AI Diagnostics & Smart Healthcare
// ─────────────────────────────────────────────────────────────────────────────
const aiFolder = {
    name: "07. AI Diagnostics & Smart Healthcare",
    item: [
        {
            name: "AI Symptom Checker (Gemini AI)",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        symptoms: ["Persistent dry cough", "Mild fever 100F", "Fatigue"],
                        duration: "3 days",
                        age: 30,
                        gender: "male",
                        existingConditions: ["Mild Asthma"]
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/ai/symptom-checker", host: ["{{baseUrl}}"], path: ["api", "ai", "symptom-checker"] },
                description: "Evaluates patient symptoms with Gemini AI to generate preliminary triage and specialist recommendation."
            }
        },
        {
            name: "AI Lab Report Analyzer (Multipart)",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [],
                body: {
                    mode: "formdata",
                    formdata: [
                        { key: "notes", value: "CBC blood test report analysis", type: "text" },
                        { key: "reportFile", type: "file", src: "" }
                    ]
                },
                url: { raw: "{{baseUrl}}/api/ai/analyze-report", host: ["{{baseUrl}}"], path: ["api", "ai", "analyze-report"] }
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 08. Diagnostic & Lab Tests
// ─────────────────────────────────────────────────────────────────────────────
const labFolder = {
    name: "08. Diagnostic & Lab Tests",
    item: [
        {
            name: "Get All Lab Tests Catalog",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/lab/tests", host: ["{{baseUrl}}"], path: ["api", "lab", "tests"] }
            }
        },
        {
            name: "Get Lab Test Details",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/lab/tests/{{labTestId}}", host: ["{{baseUrl}}"], path: ["api", "lab", "tests", "{{labTestId}}"] }
            }
        },
        {
            name: "Book Lab Test",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        testId: "{{labTestId}}",
                        bookingDate: "2026-10-25",
                        timeSlot: "08:00 AM",
                        sampleCollectionType: "home_collection",
                        address: "221B Baker Street, Sector 4, New Delhi"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/lab/bookings", host: ["{{baseUrl}}"], path: ["api", "lab", "bookings"] }
            }
        },
        {
            name: "Get My Lab Bookings",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/lab/bookings", host: ["{{baseUrl}}"], path: ["api", "lab", "bookings"] }
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 09. Emergency Services & Tele-Consultation
// ─────────────────────────────────────────────────────────────────────────────
const emergencyFolder = {
    name: "09. Emergency Services & Tele-Consultation",
    item: [
        {
            name: "Send SOS Emergency Alert",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        location: {
                            latitude: 28.6139,
                            longitude: 77.2090,
                            address: "Connaught Place, New Delhi"
                        },
                        emergencyType: "Severe chest pain / Cardiac emergency"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/emergency/sos", host: ["{{baseUrl}}"], path: ["api", "emergency", "sos"] }
            }
        },
        {
            name: "Find Nearest Ambulances",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: {
                    raw: "{{baseUrl}}/api/emergency/ambulances/nearest?lat=28.6139&lng=77.2090",
                    host: ["{{baseUrl}}"],
                    path: ["api", "emergency", "ambulances", "nearest"],
                    query: [{ key: "lat", value: "28.6139" }, { key: "lng", value: "77.2090" }]
                }
            }
        },
        {
            name: "WebRTC Video Signal",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        targetUserId: "{{doctorId}}",
                        signalData: { type: "offer", sdp: "v=0..." }
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/consultations/video/signal", host: ["{{baseUrl}}"], path: ["api", "consultations", "video", "signal"] }
            }
        },
        {
            name: "Get Consultation Room Chat Messages",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/consultations/room_101/messages", host: ["{{baseUrl}}"], path: ["api", "consultations", "room_101", "messages"] }
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. Real-time Calling & Device Notifications (ZegoCloud & FCM)
// ─────────────────────────────────────────────────────────────────────────────
const callingFolder = {
    name: "10. Real-time Calling & Device Notifications",
    item: [
        {
            name: "ZegoCloud - Generate Token04 (POST)",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        callID: "{{callId}}"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/zego/token", host: ["{{baseUrl}}"], path: ["api", "zego", "token"] },
                description: "Generates server-authoritative ZegoCloud Token04 for secure video/audio RTC calling session."
            }
        },
        {
            name: "ZegoCloud - Generate Token04 (GET Alias)",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: {
                    raw: "{{baseUrl}}/api/zego/token?callID={{callId}}",
                    host: ["{{baseUrl}}"],
                    path: ["api", "zego", "token"],
                    query: [{ key: "callID", value: "{{callId}}" }]
                }
            }
        },
        {
            name: "Send Video Call Push Notification (FCM)",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        fcmToken: "sample_device_fcm_token_here",
                        callerName: "Dr. Rajesh Sharma",
                        channelId: "medionic_call_room_101",
                        callType: "video"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/app_data/send_call_notification", host: ["{{baseUrl}}"], path: ["api", "app_data", "send_call_notification"] }
            }
        },
        {
            name: "Save / Refresh Device FCM Token",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        fcmToken: "dK9s_sample_fcm_device_token_xyz123",
                        platform: "android"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/users/fcm-token", host: ["{{baseUrl}}"], path: ["api", "users", "fcm-token"] },
                description: "Stores device push token for video call invites and real-time reminders."
            }
        },
        {
            name: "Clear Device FCM Token (On Logout)",
            request: {
                auth: authHeader("patientToken"),
                method: "DELETE",
                header: [],
                url: { raw: "{{baseUrl}}/api/users/fcm-token", host: ["{{baseUrl}}"], path: ["api", "users", "fcm-token"] },
                description: "Stops sending push notifications to device upon user sign-out."
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. Pharmacy Subsystem (Unified /api/v1)
// ─────────────────────────────────────────────────────────────────────────────
const pharmacyFolder = {
    name: "11. Pharmacy Subsystem (Unified /api/v1)",
    item: [
        {
            name: "Auth & Store Owner",
            item: [
                {
                    name: "Register Pharmacy Owner & Branch (Strict Validation)",
                    event: [saveAuthScript("pharmacyToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                full_name: "Suresh Gupta",
                                email: "pharmacy@medionic.com",
                                password: "Password@123",
                                phone: "+919811223399",
                                branch_details: {
                                    name: "Medionic Central Pharmacy",
                                    drug_license_no: "DL-UP-2024-99881",
                                    gstin: "07AAAAA0000A1Z5",
                                    address: "Shop 14, Ring Road Market, New Delhi, 110001"
                                }
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/register", host: ["{{apiPrefixV1}}"], path: ["auth", "register"] },
                        description: "Complies with registerOwnerRules (full_name, branch_details with GSTIN & Drug License regex) and auto-saves {{pharmacyToken}} & {{branchId}}."
                    }
                },
                {
                    name: "Login Pharmacy Owner / Staff",
                    event: [saveAuthScript("pharmacyToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "pharmacy@medionic.com",
                                password: "Password@123"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/login", host: ["{{apiPrefixV1}}"], path: ["auth", "login"] },
                        description: "Auto-saves {{pharmacyToken}}, {{branchId}} and {{pharmacyOwnerId}}."
                    }
                },
                {
                    name: "Get Pharmacy User Me",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/auth/me", host: ["{{apiPrefixV1}}"], path: ["auth", "me"] }
                    }
                },
                {
                    name: "Send OTP (Password Reset / Login)",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ phone: "+919811223399", purpose: "login" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/send-otp", host: ["{{apiPrefixV1}}"], path: ["auth", "send-otp"] }
                    }
                },
                {
                    name: "Verify OTP",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ phone: "+919811223399", otp: "123456" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/verify-otp", host: ["{{apiPrefixV1}}"], path: ["auth", "verify-otp"] }
                    }
                },
                {
                    name: "Refresh Pharmacy Token",
                    event: [saveAuthScript("pharmacyToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ refreshToken: "sample-refresh-token" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/refresh-token", host: ["{{apiPrefixV1}}"], path: ["auth", "refresh-token"] }
                    }
                },
                {
                    name: "Change Password",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ current_password: "Password@123", new_password: "NewPassword@123" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/change-password", host: ["{{apiPrefixV1}}"], path: ["auth", "change-password"] }
                    }
                },
                {
                    name: "Pharmacy Logout",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/auth/logout", host: ["{{apiPrefixV1}}"], path: ["auth", "logout"] }
                    }
                }
            ]
        },
        {
            name: "Branch & Stores",
            item: [
                {
                    name: "Create Pharmacy Branch",
                    event: [saveIdScript("branchId", ["_id", "id", "branchId"])],
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Medionic Saket Branch",
                                drug_license_no: "DL-DL-2024-11223",
                                gstin: "07BBBBB1111B1Z6",
                                address: "Shop 5, Community Centre, Saket, New Delhi, 110017"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/branch", host: ["{{apiPrefixV1}}"], path: ["branch"] }
                    }
                },
                {
                    name: "Get My Branch Details",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/branch/my-branch", host: ["{{apiPrefixV1}}"], path: ["branch", "my-branch"] }
                    }
                },
                {
                    name: "Get Branch by ID",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/branch/{{branchId}}", host: ["{{apiPrefixV1}}"], path: ["branch", "{{branchId}}"] }
                    }
                },
                {
                    name: "Toggle Branch Open/Closed Availability",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PATCH",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/branch/{{branchId}}/toggle-availability", host: ["{{apiPrefixV1}}"], path: ["branch", "{{branchId}}", "toggle-availability"] }
                    }
                },
                {
                    name: "List All Branches",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/branch", host: ["{{apiPrefixV1}}"], path: ["branch"] }
                    }
                }
            ]
        },
        {
            name: "Staff Management & RBAC",
            item: [
                {
                    name: "Create Staff Member",
                    event: [saveIdScript("staffId", ["_id", "id", "staffId"])],
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                full_name: "Aman Singh",
                                email: "pharmacist1@medionic.com",
                                password: "Password@123",
                                phone: "9877001122",
                                role: "PHARMACIST",
                                branch_id: "{{branchId}}"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/staff", host: ["{{apiPrefixV1}}"], path: ["staff"] },
                        description: "Complies with createStaffRules (full_name, uppercase PHARMACIST role, branch_id)."
                    }
                },
                {
                    name: "Get All Staff",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/staff", host: ["{{apiPrefixV1}}"], path: ["staff"] }
                    }
                },
                {
                    name: "Get Staff Details",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/staff/{{staffId}}", host: ["{{apiPrefixV1}}"], path: ["staff", "{{staffId}}"] }
                    }
                },
                {
                    name: "Update Staff Permissions",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PATCH",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                permissions: ["inventory_view", "billing_pos", "prescriptions_view"]
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/staff/{{staffId}}/permissions", host: ["{{apiPrefixV1}}"], path: ["staff", "{{staffId}}", "permissions"] }
                    }
                },
                {
                    name: "Update Staff Duty Status",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ duty_status: "ON_DUTY" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/staff/duty-status", host: ["{{apiPrefixV1}}"], path: ["staff", "duty-status"] }
                    }
                },
                {
                    name: "Block Staff Member",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Unauthorized discount tampering" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/staff/{{staffId}}/block", host: ["{{apiPrefixV1}}"], path: ["staff", "{{staffId}}", "block"] }
                    }
                },
                {
                    name: "Unblock Staff Member",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/staff/{{staffId}}/unblock", host: ["{{apiPrefixV1}}"], path: ["staff", "{{staffId}}", "unblock"] }
                    }
                }
            ]
        },
        {
            name: "Inventory & Medicines Management",
            item: [
                {
                    name: "Add New Medicine to Inventory",
                    event: [saveIdScript("medicineId", ["_id", "id", "medicineId"])],
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Paracetamol 650mg",
                                generic_name: "Paracetamol",
                                manufacturer: "Cipla Ltd",
                                sku: "PARA-650-01",
                                hsn_code: "300490",
                                form: "Tablet",
                                unit: "Strip",
                                unit_quantity: 10,
                                is_prescription_required: false,
                                purchase_rate: 20,
                                mrp: 35,
                                sale_price: 30,
                                gst_rate: 12,
                                low_stock_threshold: 50
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory", host: ["{{apiPrefixV1}}"], path: ["inventory"] },
                        description: "Complies with createMedicineRules and auto-saves {{medicineId}}."
                    }
                },
                {
                    name: "Get All Inventory Medicines",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{apiPrefixV1}}/inventory?search=Paracetamol&page=1&limit=20",
                            host: ["{{apiPrefixV1}}"],
                            path: ["inventory"],
                            query: [
                                { key: "search", value: "Paracetamol" },
                                { key: "page", value: "1" },
                                { key: "limit", value: "20" }
                            ]
                        }
                    }
                },
                {
                    name: "Get Medicine by ID",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/{{medicineId}}", host: ["{{apiPrefixV1}}"], path: ["inventory", "{{medicineId}}"] }
                    }
                },
                {
                    name: "Update Medicine Info",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ sale_price: 32 }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory/{{medicineId}}", host: ["{{apiPrefixV1}}"], path: ["inventory", "{{medicineId}}"] }
                    }
                },
                {
                    name: "Add Batch to Medicine",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                batch_number: "BT-2026-OCT-01",
                                expiry_date: "2027-10-01",
                                quantity: 500,
                                purchase_rate: 18,
                                mrp: 35,
                                sale_price: 30
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory/{{medicineId}}/batches", host: ["{{apiPrefixV1}}"], path: ["inventory", "{{medicineId}}", "batches"] }
                    }
                },
                {
                    name: "Get Batches for Medicine",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/{{medicineId}}/batches", host: ["{{apiPrefixV1}}"], path: ["inventory", "{{medicineId}}", "batches"] }
                    }
                },
                {
                    name: "Get Low Stock Alerts",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/low-stock", host: ["{{apiPrefixV1}}"], path: ["inventory", "low-stock"] }
                    }
                },
                {
                    name: "Get Expiring Soon Batches",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/expiring-soon", host: ["{{apiPrefixV1}}"], path: ["inventory", "expiring-soon"] }
                    }
                },
                {
                    name: "Adjust Stock (Damage / Correction)",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                medicine_id: "{{medicineId}}",
                                batch_id: "65f1a2b3c4d5e6f7a8b9c0d8",
                                adjustment_type: "REDUCE",
                                quantity: 10,
                                reason: "Damaged during transit"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory/adjust-stock", host: ["{{apiPrefixV1}}"], path: ["inventory", "adjust-stock"] }
                    }
                }
            ]
        },
        {
            name: "POS & Billing (Counter Sales)",
            item: [
                {
                    name: "Create POS Invoice (Counter Sale)",
                    event: [saveIdScript("invoiceId", ["_id", "id", "invoiceId"])],
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                items: [
                                    {
                                        medicine_id: "{{medicineId}}",
                                        batch_id: "65f1a2b3c4d5e6f7a8b9c0d8",
                                        quantity: 2,
                                        discount_percent: 5
                                    }
                                ],
                                payment_mode: "CASH",
                                patient_name: "Ramesh Kumar",
                                patient_phone: "9876543210",
                                doctor_name: "Dr Sharma",
                                amount_paid: 60,
                                notes: "Walk-in purchase"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/pos/invoices", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices"] },
                        description: "Complies with createInvoiceRules and auto-saves {{invoiceId}}."
                    }
                },
                {
                    name: "Get All POS Invoices",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/pos/invoices", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices"] }
                    }
                },
                {
                    name: "Get Invoice Details by ID",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/pos/invoices/{{invoiceId}}", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices", "{{invoiceId}}"] }
                    }
                },
                {
                    name: "Process Return / Refund on Invoice",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                items: [
                                    {
                                        medicine_id: "{{medicineId}}",
                                        quantity: 1,
                                        reason: "Incorrect dosage purchased"
                                    }
                                ]
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/pos/invoices/{{invoiceId}}/return", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices", "{{invoiceId}}", "return"] }
                    }
                },
                {
                    name: "Daily Register Summary",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/pos/daily-register", host: ["{{apiPrefixV1}}"], path: ["pos", "daily-register"] }
                    }
                }
            ]
        },
        {
            name: "Customer CRM & Khata Ledger",
            item: [
                {
                    name: "Create Customer",
                    event: [saveIdScript("customerId", ["_id", "id", "customerId"])],
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Ramesh Kumar",
                                phone: "9876543210",
                                email: "ramesh.kumar@example.com",
                                address: "B-12, Green Park",
                                city: "New Delhi",
                                pincode: "110016"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/customers", host: ["{{apiPrefixV1}}"], path: ["customers"] },
                        description: "Complies with createCustomerRules and auto-saves {{customerId}}."
                    }
                },
                {
                    name: "Get All Customers",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/customers", host: ["{{apiPrefixV1}}"], path: ["customers"] }
                    }
                },
                {
                    name: "Get Customer Details",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/customers/{{customerId}}", host: ["{{apiPrefixV1}}"], path: ["customers", "{{customerId}}"] }
                    }
                },
                {
                    name: "Get Customer Khata Ledger",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/customers/{{customerId}}/ledger", host: ["{{apiPrefixV1}}"], path: ["customers", "{{customerId}}", "ledger"] }
                    }
                },
                {
                    name: "Settle Khata Payment",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                amount: 500,
                                paymentMode: "UPI",
                                referenceId: "UPI-SETTLE-88990",
                                notes: "Partial balance clearance"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/customers/{{customerId}}/settle-ledger", host: ["{{apiPrefixV1}}"], path: ["customers", "{{customerId}}", "settle-ledger"] }
                    }
                }
            ]
        },
        {
            name: "Orders & Delivery Fulfillment",
            item: [
                {
                    name: "Create Pharmacy Order",
                    event: [saveIdScript("orderId", ["_id", "id", "orderId"])],
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                customer_name: "Rahul Verma",
                                customer_phone: "+919876543210",
                                delivery_address: "221B Baker Street, Sector 4, New Delhi",
                                items: [
                                    {
                                        medicine_id: "{{medicineId}}",
                                        quantity: 2
                                    }
                                ],
                                payment_method: "COD"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/orders", host: ["{{apiPrefixV1}}"], path: ["orders"] }
                    }
                },
                {
                    name: "Get All Pharmacy Orders",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/orders", host: ["{{apiPrefixV1}}"], path: ["orders"] }
                    }
                },
                {
                    name: "Get Order Details",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/orders/{{orderId}}", host: ["{{apiPrefixV1}}"], path: ["orders", "{{orderId}}"] }
                    }
                },
                {
                    name: "Update Order Status",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PATCH",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "PACKED" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/orders/{{orderId}}/status", host: ["{{apiPrefixV1}}"], path: ["orders", "{{orderId}}", "status"] }
                    }
                },
                {
                    name: "Assign Delivery Agent",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ delivery_agent_id: "{{staffId}}" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/orders/{{orderId}}/assign-delivery", host: ["{{apiPrefixV1}}"], path: ["orders", "{{orderId}}", "assign-delivery"] }
                    }
                }
            ]
        },
        {
            name: "Digital Prescriptions",
            item: [
                {
                    name: "Upload Prescription Image",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [],
                        body: {
                            mode: "formdata",
                            formdata: [
                                { key: "patient_name", value: "Rahul Verma", type: "text" },
                                { key: "patient_phone", value: "+919876543210", type: "text" },
                                { key: "prescription_image", type: "file", src: "" }
                            ]
                        },
                        url: { raw: "{{apiPrefixV1}}/prescriptions", host: ["{{apiPrefixV1}}"], path: ["prescriptions"] }
                    }
                },
                {
                    name: "Get All Uploaded Prescriptions",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/prescriptions", host: ["{{apiPrefixV1}}"], path: ["prescriptions"] }
                    }
                },
                {
                    name: "Get Prescription by ID",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/prescriptions/{{prescriptionId}}", host: ["{{apiPrefixV1}}"], path: ["prescriptions", "{{prescriptionId}}"] }
                    }
                },
                {
                    name: "Verify Prescription (Pharmacist Approval)",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PATCH",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                status: "VERIFIED",
                                remarks: "Dr. Ananya Sharma valid signature & MCI registration verified."
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/prescriptions/{{prescriptionId}}/verify", host: ["{{apiPrefixV1}}"], path: ["prescriptions", "{{prescriptionId}}", "verify"] }
                    }
                }
            ]
        },
        {
            name: "Reports & Financial Intelligence",
            item: [
                {
                    name: "Get Sales Report (Daily / Weekly / Monthly)",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{apiPrefixV1}}/reports/sales?period=today",
                            host: ["{{apiPrefixV1}}"],
                            path: ["reports", "sales"],
                            query: [{ key: "period", value: "today" }]
                        }
                    }
                },
                {
                    name: "Get Inventory Movement (Fast / Slow Moving)",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/reports/inventory-movement", host: ["{{apiPrefixV1}}"], path: ["reports", "inventory-movement"] }
                    }
                },
                {
                    name: "Get GST & Tax Summary Report",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/reports/gst-summary", host: ["{{apiPrefixV1}}"], path: ["reports", "gst-summary"] }
                    }
                },
                {
                    name: "Get Profit & Loss (PnL) Summary",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/reports/pnl", host: ["{{apiPrefixV1}}"], path: ["reports", "pnl"] }
                    }
                }
            ]
        },
        {
            name: "Alerts & Notifications",
            item: [
                {
                    name: "Get In-App Notifications",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/notifications", host: ["{{apiPrefixV1}}"], path: ["notifications"] }
                    }
                },
                {
                    name: "Mark All Notifications as Read",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/notifications/read-all", host: ["{{apiPrefixV1}}"], path: ["notifications", "read-all"] }
                    }
                }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. Pharmacy Legacy Catalog (/api/pharmacy)
// ─────────────────────────────────────────────────────────────────────────────
const pharmacyLegacyFolder = {
    name: "12. Pharmacy Legacy Catalog (/api/pharmacy)",
    item: [
        {
            name: "Get Products Catalog",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/pharmacy/products", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "products"] }
            }
        },
        {
            name: "Get Product Details",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/pharmacy/products/65f1a2b3c4d5e6f7a8b9c0e0", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "products", "65f1a2b3c4d5e6f7a8b9c0e0"] }
            }
        },
        {
            name: "Create Legacy Pharmacy Order",
            request: {
                auth: authHeader("patientToken"),
                method: "POST",
                header: [],
                body: {
                    mode: "formdata",
                    formdata: [
                        { key: "items", value: JSON.stringify([{ productId: "65f1a2b3c4d5e6f7a8b9c0e0", quantity: 2 }]), type: "text" },
                        { key: "deliveryAddress", value: "221B Baker Street, Sector 4, New Delhi", type: "text" },
                        { key: "paymentMethod", value: "cod", type: "text" }
                    ]
                },
                url: { raw: "{{baseUrl}}/api/pharmacy/orders", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders"] }
            }
        },
        {
            name: "Get My Legacy Pharmacy Orders",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/pharmacy/orders", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders"] }
            }
        },
        {
            name: "Get Legacy Order by ID",
            request: {
                auth: authHeader("patientToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/pharmacy/orders/{{orderId}}", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders", "{{orderId}}"] }
            }
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLE ITEMS IN COLLECTION
// ─────────────────────────────────────────────────────────────────────────────
collection.item.push(
    healthFolder,
    authFolder,
    adminFolder,
    doctorFolder,
    patientFolder,
    mrFolder,
    paymentsFolder,
    aiFolder,
    labFolder,
    emergencyFolder,
    callingFolder,
    pharmacyFolder,
    pharmacyLegacyFolder
);

// ─────────────────────────────────────────────────────────────────────────────
// WRITE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, 'medionic_postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');

console.log(`\n==========================================================`);
console.log(`🎉 Master Postman Collection successfully generated!`);
console.log(`📁 File: ${outputPath}`);
console.log(`📦 Categories: ${collection.item.length}`);
console.log(`🔑 Variables: ${collection.variable.length}`);
console.log(`==========================================================\n`);
