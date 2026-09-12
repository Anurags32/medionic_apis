const fs = require('fs');
const path = require('path');

const collection = {
    info: {
        _postman_id: "medionic-full-api-collection-v2",
        name: "Medionic HealthCare+ Complete API Collection",
        description: "Complete, production-ready Postman Collection for Medionic HealthCare+ API including Doctor, Patient, MR, Admin, Pharmacy Subsystem (v1), AI Diagnostics, Payments, and Emergency services.",
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
        { key: "adminSecretKey", value: "medionic-admin-secret-2024", type: "string" },
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
        { key: "customerId", value: "65f1a2b3c4d5e6f7a8b9c0e2", type: "string" }
    ],
    item: []
};

// Helper to make test script that saves token
function saveTokenScript(varName) {
    return {
        listen: "test",
        script: {
            exec: [
                "if (pm.response.code === 200 || pm.response.code === 201) {",
                "    var jsonData = pm.response.json();",
                "    var token = jsonData.token || (jsonData.data && jsonData.data.token) || (jsonData.data && jsonData.data.accessToken);",
                "    if (token) {",
                `        pm.collectionVariables.set("${varName}", token);`,
                `        console.log("Saved ${varName}:", token);`,
                "    }",
                "}"
            ],
            type: "text/javascript"
        }
    };
}

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

// -------------------------------------------------------------
// 00. Health & System
// -------------------------------------------------------------
const healthFolder = {
    name: "00. Health & System",
    item: [
        {
            name: "Health Check",
            request: {
                method: "GET",
                header: [],
                url: {
                    raw: "{{baseUrl}}/api/health",
                    host: ["{{baseUrl}}"],
                    path: ["api", "health"]
                },
                description: "Checks API status, Database connectivity and Node environment."
            }
        },
        {
            name: "Readiness Check",
            request: {
                method: "GET",
                header: [],
                url: {
                    raw: "{{baseUrl}}/api/ready",
                    host: ["{{baseUrl}}"],
                    path: ["api", "ready"]
                },
                description: "Kubernetes/Service readiness probe"
            }
        }
    ]
};

// -------------------------------------------------------------
// 01. Authentication & Users
// -------------------------------------------------------------
const authFolder = {
    name: "01. Authentication & Roles",
    item: [
        {
            name: "Patient Auth",
            item: [
                {
                    name: "Register Patient",
                    event: [saveTokenScript("patientToken")],
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
                                dateOfBirth: "1995-05-15",
                                address: "221B Baker Street, Sector 4, New Delhi"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/patient/register", host: ["{{baseUrl}}"], path: ["api", "auth", "patient", "register"] }
                    }
                },
                {
                    name: "Login Patient",
                    event: [saveTokenScript("patientToken")],
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
            name: "Doctor Auth",
            item: [
                {
                    name: "Register Doctor",
                    event: [saveTokenScript("doctorToken")],
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
                                experience: 8,
                                registrationNumber: "MCI-45892",
                                consultationFee: 800,
                                about: "Senior Cardiologist with 8+ years of clinical experience.",
                                clinicAddress: "Medionic Heart Care Clinic, New Delhi",
                                shift: {
                                    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                    startTime: "09:00",
                                    endTime: "17:00",
                                    slotDuration: 30
                                }
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/auth/doctor/register", host: ["{{baseUrl}}"], path: ["api", "auth", "doctor", "register"] }
                    }
                },
                {
                    name: "Login Doctor",
                    event: [saveTokenScript("doctorToken")],
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
            name: "Medical Representative (MR) Auth",
            item: [
                {
                    name: "Register MR",
                    event: [saveTokenScript("mrToken")],
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
                    event: [saveTokenScript("mrToken")],
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
                }
            ]
        },
        {
            name: "General Auth Endpoints",
            item: [
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
                    name: "Refresh Token",
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

// -------------------------------------------------------------
// 02. Admin Panel
// -------------------------------------------------------------
const adminFolder = {
    name: "02. Admin Panel",
    item: [
        {
            name: "Admin Self-Registration (Secret Key Required)",
            event: [saveTokenScript("adminToken")],
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
            event: [saveTokenScript("adminToken")],
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
            name: "Admin Dashboard Stats",
            request: {
                auth: authHeader("adminToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/admin/dashboard", host: ["{{baseUrl}}"], path: ["api", "admin", "dashboard"] }
            }
        },
        {
            name: "Doctor Management",
            item: [
                {
                    name: "Get All Doctors",
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
                    name: "Verify Doctor (Legacy Status Update)",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "verified" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/doctors/{{doctorId}}/verify", host: ["{{baseUrl}}"], path: ["api", "admin", "doctors", "{{doctorId}}", "verify"] }
                    }
                }
            ]
        },
        {
            name: "MR Management",
            item: [
                {
                    name: "Get All MRs",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/mr", host: ["{{baseUrl}}"], path: ["api", "admin", "mr"] }
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
                            raw: JSON.stringify({ reason: "Company authorization letter expired" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/mr/{{mrId}}/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "mr", "{{mrId}}", "reject"] }
                    }
                }
            ]
        },
        {
            name: "Patient Management",
            item: [
                {
                    name: "Get All Patients",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/patients?page=1&limit=20", host: ["{{baseUrl}}"], path: ["api", "admin", "patients"] }
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
            name: "Pharmacy Owners Management",
            item: [
                {
                    name: "Get All Pharmacy Owners",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/admin/pharmacy-owners?verificationStatus=pending",
                            host: ["{{baseUrl}}"],
                            path: ["api", "admin", "pharmacy-owners"],
                            query: [{ key: "verificationStatus", value: "pending" }]
                        }
                    }
                },
                {
                    name: "Get Pharmacy Owner Profile",
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
                        header: [],
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
                            raw: JSON.stringify({ reason: "Drug License certificate is invalid or unreadable" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/pharmacy-owners/{{pharmacyOwnerId}}/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "pharmacy-owners", "{{pharmacyOwnerId}}", "reject"] }
                    }
                }
            ]
        },
        {
            name: "System Users & Expense Approvals",
            item: [
                {
                    name: "Get All System Users",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/users", host: ["{{baseUrl}}"], path: ["api", "admin", "users"] }
                    }
                },
                {
                    name: "Suspend User",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Terms of service violation" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/users/{{patientId}}/suspend", host: ["{{baseUrl}}"], path: ["api", "admin", "users", "{{patientId}}", "suspend"] }
                    }
                },
                {
                    name: "Get Pending Expenses",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/expenses/pending-approvals", host: ["{{baseUrl}}"], path: ["api", "admin", "expenses", "pending-approvals"] }
                    }
                },
                {
                    name: "Approve Expense",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/admin/expenses/65f1a2b3c4d5e6f7a8b9c0e3/approve", host: ["{{baseUrl}}"], path: ["api", "admin", "expenses", "65f1a2b3c4d5e6f7a8b9c0e3", "approve"] }
                    }
                },
                {
                    name: "Reject Expense",
                    request: {
                        auth: authHeader("adminToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Missing original bills/receipts" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/expenses/65f1a2b3c4d5e6f7a8b9c0e3/reject", host: ["{{baseUrl}}"], path: ["api", "admin", "expenses", "65f1a2b3c4d5e6f7a8b9c0e3", "reject"] }
                    }
                }
            ]
        }
    ]
};

// -------------------------------------------------------------
// 03. Doctor Portal
// -------------------------------------------------------------
const doctorFolder = {
    name: "03. Doctor Portal",
    item: [
        {
            name: "Doctor Profile",
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
                                about: "Senior Cardiologist & Interventional Heart Specialist"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/profile", host: ["{{baseUrl}}"], path: ["api", "doctors", "profile"] }
                    }
                },
                {
                    name: "Get Schedule",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/schedule", host: ["{{baseUrl}}"], path: ["api", "doctors", "schedule"] }
                    }
                },
                {
                    name: "Update Schedule",
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
                            query: [{ key: "status", value: "confirmed" }, { key: "date", value: "today" }]
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
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/appointments/{{appointmentId}}/complete", host: ["{{baseUrl}}"], path: ["api", "doctors", "appointments", "{{appointmentId}}", "complete"] }
                    }
                },
                {
                    name: "Cancel Appointment",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "PUT",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Emergency surgery scheduled" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/appointments/{{appointmentId}}/cancel", host: ["{{baseUrl}}"], path: ["api", "doctors", "appointments", "{{appointmentId}}", "cancel"] }
                    }
                },
                {
                    name: "Get Doctor Patients List",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/patients", host: ["{{baseUrl}}"], path: ["api", "doctors", "patients"] }
                    }
                },
                {
                    name: "Get Patient Profile (Doctor View)",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/patients/{{patientId}}", host: ["{{baseUrl}}"], path: ["api", "doctors", "patients", "{{patientId}}"] }
                    }
                }
            ]
        },
        {
            name: "Prescriptions & MR Meetings",
            item: [
                {
                    name: "Create Prescription",
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
                                symptoms: ["Mild headache", "High BP (140/90)"],
                                medicines: [
                                    {
                                        name: "Amlodipine",
                                        dosage: "5mg",
                                        frequency: "Once daily (Morning)",
                                        duration: "30 days",
                                        instructions: "Take after breakfast"
                                    }
                                ],
                                advice: "Reduce salt intake and monitor BP every alternate day",
                                followUpDate: "2026-10-15"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/prescriptions", host: ["{{baseUrl}}"], path: ["api", "doctors", "prescriptions"] }
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
                    name: "Get MR Meetings",
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
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/mr-meetings/65f1a2b3c4d5e6f7a8b9c0e4/approve", host: ["{{baseUrl}}"], path: ["api", "doctors", "mr-meetings", "65f1a2b3c4d5e6f7a8b9c0e4", "approve"] }
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
                            raw: JSON.stringify({ reason: "Busy schedule on requested date" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/mr-meetings/65f1a2b3c4d5e6f7a8b9c0e4/reject", host: ["{{baseUrl}}"], path: ["api", "doctors", "mr-meetings", "65f1a2b3c4d5e6f7a8b9c0e4", "reject"] }
                    }
                }
            ]
        },
        {
            name: "Analytics & Earnings",
            item: [
                {
                    name: "Get Doctor Analytics",
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
                        url: { raw: "{{baseUrl}}/api/doctors/analytics/revenue", host: ["{{baseUrl}}"], path: ["api", "doctors", "analytics", "revenue"] }
                    }
                },
                {
                    name: "Get Doctor Earnings",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/doctors/earnings", host: ["{{baseUrl}}"], path: ["api", "doctors", "earnings"] }
                    }
                },
                {
                    name: "Request Withdrawal",
                    request: {
                        auth: authHeader("doctorToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                amount: 15000,
                                bankAccount: "HDFC0001234",
                                ifscCode: "HDFC0001234"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/doctors/earnings/withdraw", host: ["{{baseUrl}}"], path: ["api", "doctors", "earnings", "withdraw"] }
                    }
                }
            ]
        }
    ]
};

// -------------------------------------------------------------
// 04. Patient Portal
// -------------------------------------------------------------
const patientFolder = {
    name: "04. Patient Portal",
    item: [
        {
            name: "Profile & Dashboard",
            item: [
                {
                    name: "Patient Dashboard",
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
                                emergencyContact: "+919876543299"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/profile", host: ["{{baseUrl}}"], path: ["api", "patients", "profile"] }
                    }
                }
            ]
        },
        {
            name: "Doctor Search & Appointments",
            item: [
                {
                    name: "Search Doctors",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{baseUrl}}/api/patients/doctors?specialization=Cardiology&city=Delhi",
                            host: ["{{baseUrl}}"],
                            path: ["api", "patients", "doctors"],
                            query: [{ key: "specialization", value: "Cardiology" }, { key: "city", value: "Delhi" }]
                        }
                    }
                },
                {
                    name: "Get Doctor Details",
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
                            raw: "{{baseUrl}}/api/patients/doctors/{{doctorId}}/available-slots?date=2026-09-15",
                            host: ["{{baseUrl}}"],
                            path: ["api", "patients", "doctors", "{{doctorId}}", "available-slots"],
                            query: [{ key: "date", value: "2026-09-15" }]
                        }
                    }
                },
                {
                    name: "Book Appointment",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                doctorId: "{{doctorId}}",
                                appointmentDate: "2026-09-15",
                                timeSlot: "10:30 AM",
                                reason: "Routine cardiac checkup and BP monitoring",
                                type: "in-person"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments"] }
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
                                appointmentDate: "2026-09-18",
                                timeSlot: "11:00 AM"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/reschedule", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "reschedule"] }
                    }
                },
                {
                    name: "Pay Appointment Fee",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                paymentMethod: "razorpay"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/pay", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "pay"] }
                    }
                },
                {
                    name: "Rate Appointment & Doctor",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                rating: 5,
                                review: "Extremely professional, patient, and thorough doctor!"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/rate", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "rate"] }
                    }
                },
                {
                    name: "Get Video Consultation Room Session",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/appointments/{{appointmentId}}/consultation-session", host: ["{{baseUrl}}"], path: ["api", "patients", "appointments", "{{appointmentId}}", "consultation-session"] }
                    }
                }
            ]
        },
        {
            name: "Prescriptions & Health Records",
            item: [
                {
                    name: "Get My Prescriptions",
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
                    name: "Get Medical Records",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/medical-records", host: ["{{baseUrl}}"], path: ["api", "patients", "medical-records"] }
                    }
                },
                {
                    name: "Log Health Metric (Vitals)",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                type: "blood_pressure",
                                value: { systolic: 120, diastolic: 80 },
                                unit: "mmHg",
                                recordedAt: new Date().toISOString()
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/health-tracking", host: ["{{baseUrl}}"], path: ["api", "patients", "health-tracking"] }
                    }
                },
                {
                    name: "Get Health Statistics",
                    request: {
                        auth: authHeader("patientToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/patients/health-tracking/statistics", host: ["{{baseUrl}}"], path: ["api", "patients", "health-tracking", "statistics"] }
                    }
                }
            ]
        },
        {
            name: "Family & Emergency Contacts",
            item: [
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
                                name: "Pooja Verma",
                                relation: "Spouse",
                                age: 28,
                                gender: "female",
                                bloodGroup: "A+"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/family-members", host: ["{{baseUrl}}"], path: ["api", "patients", "family-members"] }
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
                                name: "Ramesh Verma (Father)",
                                phone: "+919876500099",
                                relationship: "Father"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/patients/emergency-contacts", host: ["{{baseUrl}}"], path: ["api", "patients", "emergency-contacts"] }
                    }
                }
            ]
        }
    ]
};

// -------------------------------------------------------------
// 05. Medical Representative (MR)
// -------------------------------------------------------------
const mrFolder = {
    name: "05. Medical Representative (MR)",
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
            name: "Search Target Doctors",
            request: {
                auth: authHeader("mrToken"),
                method: "GET",
                header: [],
                url: { raw: "{{baseUrl}}/api/mr/doctors?territory=North Delhi", host: ["{{baseUrl}}"], path: ["api", "mr", "doctors"] }
            }
        },
        {
            name: "Request Meeting with Doctor",
            request: {
                auth: authHeader("mrToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        doctorId: "{{doctorId}}",
                        preferredDate: "2026-09-20",
                        preferredTimeSlot: "02:00 PM",
                        agenda: "Product Demonstration: New Cardiac Drug formulations & clinical samples"
                    }, null, 2)
                },
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
            name: "Submit Daily Call Report (DCR)",
            request: {
                auth: authHeader("mrToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        date: new Date().toISOString(),
                        doctorId: "{{doctorId}}",
                        productsDiscussed: ["CardioMed 10", "VasoPure 50"],
                        samplesGiven: [{ productName: "CardioMed 10", quantity: 5 }],
                        doctorFeedback: "Positive response, interested in 100mg trial batch",
                        nextFollowUp: "2026-10-05"
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
            name: "Log Field Expense",
            request: {
                auth: authHeader("mrToken"),
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        category: "Travel & Fuel",
                        amount: 850,
                        date: new Date().toISOString(),
                        description: "Travel to North Delhi Clinic visits"
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
        },
        {
            name: "Chemist Directory",
            item: [
                {
                    name: "Get Chemists List",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{baseUrl}}/api/mr/chemists", host: ["{{baseUrl}}"], path: ["api", "mr", "chemists"] }
                    }
                },
                {
                    name: "Add New Chemist",
                    request: {
                        auth: authHeader("mrToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                chemistName: "Apollo MedPlus Pharmacy",
                                contactPerson: "Suresh Gupta",
                                phone: "+919811223344",
                                address: "Shop 12, Market Complex, North Delhi",
                                territory: "North Delhi"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/mr/chemists", host: ["{{baseUrl}}"], path: ["api", "mr", "chemists"] }
                    }
                }
            ]
        }
    ]
};

// -------------------------------------------------------------
// 06. Payments & Billing
// -------------------------------------------------------------
const paymentsFolder = {
    name: "06. Payments & Razorpay",
    item: [
        {
            name: "Create Payment Order (Authenticated)",
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
            name: "Verify Payment Signature",
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
            name: "Direct Create Order (/api/create-order)",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        amount: 500,
                        currency: "INR",
                        receipt: "receipt_01"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/create-order", host: ["{{baseUrl}}"], path: ["api", "create-order"] }
            }
        },
        {
            name: "Payment Webhook Simulation",
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

// -------------------------------------------------------------
// 07. AI & Smart Healthcare
// -------------------------------------------------------------
const aiFolder = {
    name: "07. AI & Smart Healthcare",
    item: [
        {
            name: "AI Symptom Checker",
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

// -------------------------------------------------------------
// 08. Diagnostic & Lab Tests
// -------------------------------------------------------------
const labFolder = {
    name: "08. Diagnostic & Lab Tests",
    item: [
        {
            name: "Get All Lab Tests",
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
                url: { raw: "{{baseUrl}}/api/lab/tests/65f1a2b3c4d5e6f7a8b9c0e5", host: ["{{baseUrl}}"], path: ["api", "lab", "tests", "65f1a2b3c4d5e6f7a8b9c0e5"] }
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
                        testId: "65f1a2b3c4d5e6f7a8b9c0e5",
                        bookingDate: "2026-09-18",
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

// -------------------------------------------------------------
// 09. Emergency & Tele-Consultation
// -------------------------------------------------------------
const emergencyFolder = {
    name: "09. Emergency & Tele-Consultation",
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
        },
        {
            name: "Send Video Call Push Notification",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: {
                    mode: "raw",
                    raw: JSON.stringify({
                        fcmToken: "sample_device_fcm_token",
                        callerName: "Dr. Ananya Sharma",
                        channelId: "medionic_channel_45",
                        callType: "video"
                    }, null, 2)
                },
                url: { raw: "{{baseUrl}}/api/app_data/send_call_notification", host: ["{{baseUrl}}"], path: ["api", "app_data", "send_call_notification"] }
            }
        }
    ]
};

// -------------------------------------------------------------
// 10. Pharmacy Subsystem (v1)
// -------------------------------------------------------------
const pharmacyFolder = {
    name: "10. Pharmacy Subsystem (v1)",
    item: [
        {
            name: "Auth & Store Owner",
            item: [
                {
                    name: "Register Pharmacy Owner",
                    event: [saveTokenScript("pharmacyToken")],
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Suresh Gupta",
                                email: "pharmacy@medionic.com",
                                password: "Password@123",
                                phone: "+919811223399",
                                pharmacyName: "Medionic Central Pharmacy",
                                drugLicenseNumber: "DL-DL-2024-99881",
                                gstin: "07AAAAA0000A1Z5",
                                address: {
                                    street: "Shop 14, Ring Road Market",
                                    city: "New Delhi",
                                    state: "Delhi",
                                    pincode: "110001"
                                }
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/auth/register", host: ["{{apiPrefixV1}}"], path: ["auth", "register"] }
                    }
                },
                {
                    name: "Login Pharmacy Owner/Staff",
                    event: [saveTokenScript("pharmacyToken")],
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
                        url: { raw: "{{apiPrefixV1}}/auth/login", host: ["{{apiPrefixV1}}"], path: ["auth", "login"] }
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
                            raw: JSON.stringify({ phone: "+919811223399" }, null, 2)
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
                }
            ]
        },
        {
            name: "Branch & Stores",
            item: [
                {
                    name: "Create Pharmacy Branch",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                branchName: "Medionic Saket Branch",
                                branchCode: "MED-SAKET-01",
                                address: {
                                    street: "Shop 5, Community Centre, Saket",
                                    city: "New Delhi",
                                    state: "Delhi",
                                    pincode: "110017"
                                },
                                contactNumber: "+919811223388"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/branch", host: ["{{apiPrefixV1}}"], path: ["branch"] }
                    }
                },
                {
                    name: "Get All My Branches",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/branch/all-branches", host: ["{{apiPrefixV1}}"], path: ["branch", "all-branches"] }
                    }
                },
                {
                    name: "Get Current Branch Info",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/branch/my-branch", host: ["{{apiPrefixV1}}"], path: ["branch", "my-branch"] }
                    }
                }
            ]
        },
        {
            name: "Staff Management & RBAC",
            item: [
                {
                    name: "Create Staff Member",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Aman Singh",
                                email: "pharmacist1@medionic.com",
                                password: "Password@123",
                                phone: "+919877001122",
                                role: "pharmacist",
                                branchId: "{{branchId}}"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/staff", host: ["{{apiPrefixV1}}"], path: ["staff"] }
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
                            raw: JSON.stringify({ isOnline: true, dutyStatus: "on_duty" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/staff/duty-status", host: ["{{apiPrefixV1}}"], path: ["staff", "duty-status"] }
                    }
                }
            ]
        },
        {
            name: "Inventory & Batches",
            item: [
                {
                    name: "Get Medicine Categories",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/categories", host: ["{{apiPrefixV1}}"], path: ["inventory", "categories"] }
                    }
                },
                {
                    name: "Create Category",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Antibiotics",
                                description: "Broad and narrow spectrum antibiotic medicines"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory/categories", host: ["{{apiPrefixV1}}"], path: ["inventory", "categories"] }
                    }
                },
                {
                    name: "Get Medicines List",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{apiPrefixV1}}/inventory/medicines?search=Paracetamol&page=1&limit=20",
                            host: ["{{apiPrefixV1}}"],
                            path: ["inventory", "medicines"],
                            query: [{ key: "search", value: "Paracetamol" }, { key: "page", value: "1" }, { key: "limit", value: "20" }]
                        }
                    }
                },
                {
                    name: "Create Medicine",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Augmentin 625 Duo Tablet",
                                genericName: "Amoxicillin + Clavulanic Acid",
                                manufacturer: "GSK",
                                category: "Antibiotics",
                                hsnCode: "3004",
                                gstRate: 12,
                                unit: "strip",
                                minStockAlert: 20,
                                rackLocation: "Aisle 3 - Shelf B",
                                requiresPrescription: true
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory/medicines", host: ["{{apiPrefixV1}}"], path: ["inventory", "medicines"] }
                    }
                },
                {
                    name: "Add Medicine Batch",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                medicineId: "{{medicineId}}",
                                batchNumber: "AUG-2024-88A",
                                expiryDate: "2027-08-31",
                                purchasePrice: 150,
                                mrp: 210,
                                sellingPrice: 195,
                                quantity: 100,
                                barcode: "8901234567890"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/inventory/batches", host: ["{{apiPrefixV1}}"], path: ["inventory", "batches"] }
                    }
                },
                {
                    name: "Lookup Barcode",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/barcode/8901234567890", host: ["{{apiPrefixV1}}"], path: ["inventory", "barcode", "8901234567890"] }
                    }
                },
                {
                    name: "Get Low Stock Alerts",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/alerts/low-stock", host: ["{{apiPrefixV1}}"], path: ["inventory", "alerts", "low-stock"] }
                    }
                },
                {
                    name: "Get Expiring Batches",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/inventory/alerts/expiring?days=90", host: ["{{apiPrefixV1}}"], path: ["inventory", "alerts", "expiring"], query: [{ key: "days", value: "90" }] }
                    }
                }
            ]
        },
        {
            name: "POS & Invoicing",
            item: [
                {
                    name: "Create POS Invoice / Walk-in Bill",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                customerName: "Rajesh Kumar",
                                customerPhone: "+919876500111",
                                doctorName: "Dr. Ananya Sharma",
                                items: [
                                    {
                                        medicineId: "{{medicineId}}",
                                        batchNumber: "AUG-2024-88A",
                                        quantity: 2,
                                        unitPrice: 195,
                                        discountPercent: 5,
                                        gstPercent: 12
                                    }
                                ],
                                paymentMode: "cash",
                                paidAmount: 370
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/pos/invoices", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices"] }
                    }
                },
                {
                    name: "Get All Invoices",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/pos/invoices", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices"] }
                    }
                },
                {
                    name: "Get Invoice Print Bill / Receipt",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/pos/invoices/{{invoiceId}}/receipt", host: ["{{apiPrefixV1}}"], path: ["pos", "invoices", "{{invoiceId}}", "receipt"] }
                    }
                }
            ]
        },
        {
            name: "Online Orders & Prescriptions",
            item: [
                {
                    name: "Get Store Orders",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/orders?status=pending", host: ["{{apiPrefixV1}}"], path: ["orders"], query: [{ key: "status", value: "pending" }] }
                    }
                },
                {
                    name: "Accept Order",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/orders/{{orderId}}/accept", host: ["{{apiPrefixV1}}"], path: ["orders", "{{orderId}}", "accept"] }
                    }
                },
                {
                    name: "Update Order Status (Packed / Out for Delivery)",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PATCH",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "out_for_delivery", deliveryPartner: "Dunzo / Shadowfax" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/orders/{{orderId}}/status", host: ["{{apiPrefixV1}}"], path: ["orders", "{{orderId}}", "status"] }
                    }
                },
                {
                    name: "Get Uploaded Prescriptions",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/prescriptions", host: ["{{apiPrefixV1}}"], path: ["prescriptions"] }
                    }
                },
                {
                    name: "Verify & Dispense Prescription",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "PATCH",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ isVerified: true, pharmacistNotes: "Dosage verified with registered doctor" }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/prescriptions/{{prescriptionId}}/verify", host: ["{{apiPrefixV1}}"], path: ["prescriptions", "{{prescriptionId}}", "verify"] }
                    }
                }
            ]
        },
        {
            name: "Customers & Khata (Credit Book)",
            item: [
                {
                    name: "Get All Pharmacy Customers",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/customers", host: ["{{apiPrefixV1}}"], path: ["customers"] }
                    }
                },
                {
                    name: "Add Customer",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                name: "Harish Sharma",
                                phone: "+919812345678",
                                email: "harish@gmail.com",
                                creditLimit: 5000,
                                address: "Flat 402, Royal Residency, New Delhi"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/customers", host: ["{{apiPrefixV1}}"], path: ["customers"] }
                    }
                },
                {
                    name: "Settle Khata Credit",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                amount: 1500,
                                paymentMode: "upi",
                                referenceId: "UPI99882211"
                            }, null, 2)
                        },
                        url: { raw: "{{apiPrefixV1}}/customers/{{customerId}}/settle-khata", host: ["{{apiPrefixV1}}"], path: ["customers", "{{customerId}}", "settle-khata"] }
                    }
                }
            ]
        },
        {
            name: "Reports & Notifications",
            item: [
                {
                    name: "Get Pharmacy Dashboard Stats",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/reports/dashboard", host: ["{{apiPrefixV1}}"], path: ["reports", "dashboard"] }
                    }
                },
                {
                    name: "Get Sales Report",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: {
                            raw: "{{apiPrefixV1}}/reports/sales?period=monthly&startDate=2026-09-01&endDate=2026-09-30",
                            host: ["{{apiPrefixV1}}"],
                            path: ["reports", "sales"],
                            query: [
                                { key: "period", value: "monthly" },
                                { key: "startDate", value: "2026-09-01" },
                                { key: "endDate", value: "2026-09-30" }
                            ]
                        }
                    }
                },
                {
                    name: "Get Top Selling Medicines",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/reports/top-medicines?limit=10", host: ["{{apiPrefixV1}}"], path: ["reports", "top-medicines"], query: [{ key: "limit", value: "10" }] }
                    }
                },
                {
                    name: "Get GST Inward/Outward Report",
                    request: {
                        auth: authHeader("pharmacyToken"),
                        method: "GET",
                        header: [],
                        url: { raw: "{{apiPrefixV1}}/reports/gst?month=09&year=2026", host: ["{{apiPrefixV1}}"], path: ["reports", "gst"], query: [{ key: "month", value: "09" }, { key: "year", value: "2026" }] }
                    }
                },
                {
                    name: "Get Notifications",
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

// Add all folders to items
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
    pharmacyFolder
);

// Write to JSON file
const outputPath = path.join(__dirname, 'medionic_postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');

console.log(`✅ Postman Collection successfully generated with ${collection.item.length} main categories at: ${outputPath}`);
