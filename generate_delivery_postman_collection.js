const fs = require('fs');
const path = require('path');

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
                "        if (res.data.partner && res.data.partner.id) { pm.collectionVariables.set('partnerId', res.data.partner.id); }",
                "        if (res.data.delivery && res.data.delivery.id) { pm.collectionVariables.set('deliveryId', res.data.delivery.id); }",
                "        if (res.data.deliveryId) { pm.collectionVariables.set('deliveryId', res.data.deliveryId); }",
                "        if (res.data.assignmentId) { pm.collectionVariables.set('assignmentId', res.data.assignmentId); }",
                "    }",
                "}"
            ],
            type: "text/javascript"
        }
    };
}

const collection = {
    info: {
        _postman_id: "medisleep-delivery-management-v1",
        name: "MediSleep – Delivery Management API Collection",
        description: "Complete API collection for MediSleep Multi-Pharmacy Medicine Delivery Management System (Platform Partners, Pharmacy Staff, Assignments, Lifecycle, Consumer Tracking, and Admin).",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
        { key: "baseUrl", value: "http://localhost:5001" },
        { key: "deliveryPartnerToken", value: "" },
        { key: "pharmacyToken", value: "" },
        { key: "adminToken", value: "" },
        { key: "consumerToken", value: "" },
        { key: "deliveryId", value: "" },
        { key: "assignmentId", value: "" },
        { key: "orderId", value: "" },
        { key: "staffId", value: "" },
        { key: "partnerId", value: "" }
    ],
    item: [
        {
            name: "Group A: Delivery Partner Authentication",
            item: [
                {
                    name: "Register Platform Partner",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                full_name: "Vikram Malhotra",
                                email: "vikram.delivery@gmail.com",
                                mobile: "9876541122",
                                password: "Partner@1234",
                                vehicle_type: "MOTORCYCLE",
                                vehicle_number: "DL-01-EE-9988"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/auth/register", host: ["{{baseUrl}}"], path: ["api", "delivery", "auth", "register"] }
                    },
                    event: [saveAuthScript("deliveryPartnerToken")]
                },
                {
                    name: "Partner Login",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                email: "vikram.delivery@gmail.com",
                                password: "Partner@1234"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/auth/login", host: ["{{baseUrl}}"], path: ["api", "delivery", "auth", "login"] }
                    },
                    event: [saveAuthScript("deliveryPartnerToken")]
                },
                {
                    name: "Send OTP",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ mobile: "9876541122" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/auth/send-otp", host: ["{{baseUrl}}"], path: ["api", "delivery", "auth", "send-otp"] }
                    }
                },
                {
                    name: "Verify OTP",
                    request: {
                        method: "POST",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ mobile: "9876541122", otp: "123456" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/auth/verify-otp", host: ["{{baseUrl}}"], path: ["api", "delivery", "auth", "verify-otp"] }
                    },
                    event: [saveAuthScript("deliveryPartnerToken")]
                },
                {
                    name: "Get Me (Current Partner Profile)",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/auth/me", host: ["{{baseUrl}}"], path: ["api", "delivery", "auth", "me"] }
                    }
                },
                {
                    name: "Logout",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/auth/logout", host: ["{{baseUrl}}"], path: ["api", "delivery", "auth", "logout"] }
                    }
                }
            ]
        },
        {
            name: "Group B: Partner Profile & KYC",
            item: [
                {
                    name: "Get Profile",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/profile", host: ["{{baseUrl}}"], path: ["api", "delivery", "profile"] }
                    }
                },
                {
                    name: "Update Profile",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ full_name: "Vikram Malhotra (Senior Partner)" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/profile", host: ["{{baseUrl}}"], path: ["api", "delivery", "profile"] }
                    }
                },
                {
                    name: "Upload KYC Document",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                doc_type: "DRIVING_LICENSE",
                                doc_number: "DL-1420110012345",
                                doc_url: "https://storage.medisleep.com/kyc/dl-sample.jpg"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/kyc/upload", host: ["{{baseUrl}}"], path: ["api", "delivery", "kyc", "upload"] }
                    }
                },
                {
                    name: "Get KYC Status",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/kyc/status", host: ["{{baseUrl}}"], path: ["api", "delivery", "kyc", "status"] }
                    }
                },
                {
                    name: "Update Vehicle",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                vehicle_type: "ELECTRIC_VEHICLE",
                                vehicle_number: "DL-01-EV-5555"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/vehicle", host: ["{{baseUrl}}"], path: ["api", "delivery", "vehicle"] }
                    }
                },
                {
                    name: "Get Account Status",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/account/status", host: ["{{baseUrl}}"], path: ["api", "delivery", "account", "status"] }
                    }
                }
            ]
        },
        {
            name: "Group C: Availability & Location",
            item: [
                {
                    name: "Update Availability (Toggle Online/Offline)",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ is_online: true, is_available: true }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/availability", host: ["{{baseUrl}}"], path: ["api", "delivery", "availability"] }
                    }
                },
                {
                    name: "Update Live GPS Location",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                latitude: 28.6315,
                                longitude: 77.2167,
                                heading: 45,
                                speed: 20,
                                accuracy: 4
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/location/update", host: ["{{baseUrl}}"], path: ["api", "delivery", "location", "update"] }
                    }
                },
                {
                    name: "Get Current Location",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/location/current", host: ["{{baseUrl}}"], path: ["api", "delivery", "location", "current"] }
                    }
                },
                {
                    name: "Get Earnings Summary",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/earnings/summary", host: ["{{baseUrl}}"], path: ["api", "delivery", "earnings", "summary"] }
                    }
                }
            ]
        },
        {
            name: "Group D: Delivery Requests Feed",
            item: [
                {
                    name: "Get Offered Requests",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/requests", host: ["{{baseUrl}}"], path: ["api", "delivery", "requests"] }
                    }
                },
                {
                    name: "Accept Request",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/requests/{{assignmentId}}/accept", host: ["{{baseUrl}}"], path: ["api", "delivery", "requests", "{{assignmentId}}", "accept"] }
                    }
                },
                {
                    name: "Reject Request",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ reason: "Vehicle issue or too far" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/delivery/requests/{{assignmentId}}/reject", host: ["{{baseUrl}}"], path: ["api", "delivery", "requests", "{{assignmentId}}", "reject"] }
                    }
                },
                {
                    name: "Get Active Delivery",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/active", host: ["{{baseUrl}}"], path: ["api", "delivery", "active"] }
                    }
                },
                {
                    name: "Get Delivery History",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/history?page=1&limit=20", host: ["{{baseUrl}}"], path: ["api", "delivery", "history"], query: [{ key: "page", value: "1" }, { key: "limit", value: "20" }] }
                    }
                }
            ]
        },
        {
            name: "Group E: Delivery Lifecycle",
            item: [
                {
                    name: "Partner Reached Pharmacy",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/reached-pharmacy", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "reached-pharmacy"] }
                    }
                },
                {
                    name: "Verify Pickup OTP",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ otp: "123456" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/verify-pickup-otp", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "verify-pickup-otp"] }
                    }
                },
                {
                    name: "Confirm Pickup",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ notes: "Package picked up in good condition" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/pickup-confirm", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "pickup-confirm"] }
                    }
                },
                {
                    name: "Start Out-For-Delivery Journey",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/start-delivery", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "start-delivery"] }
                    }
                },
                {
                    name: "Partner Reached Customer Location",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/reached-customer", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "reached-customer"] }
                    }
                },
                {
                    name: "Verify Delivery OTP",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ otp: "654321" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/verify-delivery-otp", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "verify-delivery-otp"] }
                    }
                },
                {
                    name: "Complete Delivery",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ notes: "Delivered to customer directly" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/complete", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "complete"] }
                    }
                },
                {
                    name: "Fail Delivery",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ reason: "Customer door locked and phone unanswered" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/fail", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "fail"] }
                    }
                },
                {
                    name: "Return Delivery to Pharmacy",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ reason: "Customer rejected medicine box" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/return", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "return"] }
                    }
                },
                {
                    name: "Get Delivery Tracking & Breadcrumbs",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{deliveryPartnerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/delivery/{{deliveryId}}/tracking", host: ["{{baseUrl}}"], path: ["api", "delivery", "{{deliveryId}}", "tracking"] }
                    }
                }
            ]
        },
        {
            name: "Group F: Pharmacy Staff Management",
            item: [
                {
                    name: "Create Pharmacy Delivery Staff",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{pharmacyToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                full_name: "Karan Singh",
                                email: "karan.staff@pharmacy.com",
                                mobile: "9811223344",
                                password: "Staff@1234",
                                vehicle_type: "SCOOTER",
                                vehicle_number: "DL-01-SS-1122"
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/pharmacy/delivery-staff", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "delivery-staff"] }
                    }
                },
                {
                    name: "Get Pharmacy Delivery Staff List",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{pharmacyToken}}" }],
                        url: { raw: "{{baseUrl}}/api/pharmacy/delivery-staff", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "delivery-staff"] }
                    }
                },
                {
                    name: "Update Delivery Staff Status",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{pharmacyToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ status: "ACTIVE" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/pharmacy/delivery-staff/{{staffId}}/status", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "delivery-staff", "{{staffId}}", "status"] }
                    }
                }
            ]
        },
        {
            name: "Group G: Pharmacy Delivery Assignment",
            item: [
                {
                    name: "Get Pharmacy Delivery Settings",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{pharmacyToken}}" }],
                        url: { raw: "{{baseUrl}}/api/pharmacy/delivery/settings", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "delivery", "settings"] }
                    }
                },
                {
                    name: "Update Delivery Settings",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{pharmacyToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({
                                delivery_mode: "BOTH",
                                max_assignment_radius_km: 12,
                                auto_assignment_enabled: true
                            }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/pharmacy/delivery/settings", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "delivery", "settings"] }
                    }
                },
                {
                    name: "Get Order Delivery Options",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{pharmacyToken}}" }],
                        url: { raw: "{{baseUrl}}/api/pharmacy/orders/{{orderId}}/delivery-options", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders", "{{orderId}}", "delivery-options"] }
                    }
                },
                {
                    name: "Auto-Assign Delivery",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{pharmacyToken}}" }],
                        url: { raw: "{{baseUrl}}/api/pharmacy/orders/{{orderId}}/auto-assign", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders", "{{orderId}}", "auto-assign"] }
                    }
                },
                {
                    name: "Manual Assign Delivery",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{pharmacyToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ partner_id: "{{partnerId}}" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/pharmacy/orders/{{orderId}}/assign-delivery", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders", "{{orderId}}", "assign-delivery"] }
                    }
                },
                {
                    name: "Reassign Delivery",
                    request: {
                        method: "POST",
                        header: [{ key: "Authorization", value: "Bearer {{pharmacyToken}}" }],
                        url: { raw: "{{baseUrl}}/api/pharmacy/orders/{{orderId}}/reassign-delivery", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders", "{{orderId}}", "reassign-delivery"] }
                    }
                },
                {
                    name: "Cancel Delivery",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{pharmacyToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ reason: "Customer cancelled" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/pharmacy/orders/{{orderId}}/cancel-delivery", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "orders", "{{orderId}}", "cancel-delivery"] }
                    }
                },
                {
                    name: "Get Pharmacy Deliveries List",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{pharmacyToken}}" }],
                        url: { raw: "{{baseUrl}}/api/pharmacy/deliveries?page=1&limit=20", host: ["{{baseUrl}}"], path: ["api", "pharmacy", "deliveries"], query: [{ key: "page", value: "1" }, { key: "limit", value: "20" }] }
                    }
                }
            ]
        },
        {
            name: "Group H: Consumer Tracking",
            item: [
                {
                    name: "Get Order Delivery Info",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{consumerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/consumer/orders/{{orderId}}/delivery", host: ["{{baseUrl}}"], path: ["api", "consumer", "orders", "{{orderId}}", "delivery"] }
                    }
                },
                {
                    name: "Get Order Live Tracking",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{consumerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/consumer/orders/{{orderId}}/tracking", host: ["{{baseUrl}}"], path: ["api", "consumer", "orders", "{{orderId}}", "tracking"] }
                    }
                },
                {
                    name: "Get Delivery Status",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{consumerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/consumer/orders/{{orderId}}/delivery-status", host: ["{{baseUrl}}"], path: ["api", "consumer", "orders", "{{orderId}}", "delivery-status"] }
                    }
                },
                {
                    name: "Get Masked Delivery Partner Details",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{consumerToken}}" }],
                        url: { raw: "{{baseUrl}}/api/consumer/orders/{{orderId}}/delivery-partner", host: ["{{baseUrl}}"], path: ["api", "consumer", "orders", "{{orderId}}", "delivery-partner"] }
                    }
                }
            ]
        },
        {
            name: "Group I: Admin Management",
            item: [
                {
                    name: "Get All Delivery Partners",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
                        url: { raw: "{{baseUrl}}/api/admin/delivery/partners?page=1&limit=20", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "partners"], query: [{ key: "page", value: "1" }, { key: "limit", value: "20" }] }
                    }
                },
                {
                    name: "Get Partner Details",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
                        url: { raw: "{{baseUrl}}/api/admin/delivery/partners/{{partnerId}}", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "partners", "{{partnerId}}"] }
                    }
                },
                {
                    name: "Verify Partner KYC",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{adminToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: {
                            mode: "raw",
                            raw: JSON.stringify({ status: "VERIFIED", remarks: "All documents approved" }, null, 2)
                        },
                        url: { raw: "{{baseUrl}}/api/admin/delivery/partners/{{partnerId}}/verify", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "partners", "{{partnerId}}", "verify"] }
                    }
                },
                {
                    name: "Update Partner Status",
                    request: {
                        method: "PUT",
                        header: [
                            { key: "Authorization", value: "Bearer {{adminToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ status: "ACTIVE" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/admin/delivery/partners/{{partnerId}}/status", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "partners", "{{partnerId}}", "status"] }
                    }
                },
                {
                    name: "Suspend Partner",
                    request: {
                        method: "POST",
                        header: [
                            { key: "Authorization", value: "Bearer {{adminToken}}" },
                            { key: "Content-Type", value: "application/json" }
                        ],
                        body: { mode: "raw", raw: JSON.stringify({ reason: "Safety infraction" }, null, 2) },
                        url: { raw: "{{baseUrl}}/api/admin/delivery/partners/{{partnerId}}/suspend", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "partners", "{{partnerId}}", "suspend"] }
                    }
                },
                {
                    name: "Get Delivery Assignments Audit Log",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
                        url: { raw: "{{baseUrl}}/api/admin/delivery/assignments?page=1&limit=20", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "assignments"], query: [{ key: "page", value: "1" }, { key: "limit", value: "20" }] }
                    }
                },
                {
                    name: "Get Delivery Analytics",
                    request: {
                        method: "GET",
                        header: [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
                        url: { raw: "{{baseUrl}}/api/admin/delivery/analytics", host: ["{{baseUrl}}"], path: ["api", "admin", "delivery", "analytics"] }
                    }
                }
            ]
        }
    ]
};

const outputPath = path.join(__dirname, 'medisleep_delivery_postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
console.log(`✅ Generated Postman Collection at: ${outputPath}`);

