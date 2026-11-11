# MediSleep Delivery Management Backend Architecture & API Specification

Comprehensive documentation for the MediSleep multi-pharmacy delivery management backend subsystem supporting Platform Partners (`PLATFORM_PARTNER`) and Pharmacy Staff (`PHARMACY_STAFF`).

---

## 1. Backend Audit Report

- **Architecture Stack**: Node.js, Express.js, MongoDB/Mongoose (Mongoose v8.0.0), Socket.IO v4.8.3, Firebase Admin SDK v14.3.0.
- **Consumer/Patient Module**: `models/Patient.js` + `models/PharmacyOrder.js` (legacy orders).
- **Pharmacy Subsystem**: `models/pharmacy/branch.model.js` (Branch), `models/pharmacy/user.model.js` (PharmacyStaff), `models/pharmacy/order.model.js` (Unified branch order).
- **Inventory/Stock**: `models/pharmacy/medicine.model.js`, `models/pharmacy/batch.model.js` with FEFO batch allocation.
- **Real-Time Layer**: Socket.IO with unified room hierarchy and presence map.
- **FCM**: Firebase Admin SDK initialized with high-priority Android/APNs payload support.
- **Geospatial**: Upgraded from flat lat/long to GeoJSON `Point` (`coordinates: [longitude, latitude]`) with `2dsphere` indexes.

---

## 2. Existing vs. New Files Breakdown

### Existing Files Extended
- `config/constants.js`: Delivery status constants and partner roles.
- `config/pharmacyConstants.js`: `DELIVERY_STAFF` role, `DELIVERY_MANAGE` & `DELIVERY_EXECUTE` feature permissions, `READY_FOR_PICKUP` and `DELIVERY_ASSIGNED` order statuses.
- `models/pharmacy/branch.model.js`: Added GeoJSON `location: { type: 'Point', coordinates: [lng, lat] }` with `2dsphere` index and pre-save coordinate sync.
- `models/pharmacy/order.model.js`: Added delivery fields (`fulfillment_type`, `delivery_required`, `delivery_mode`, `delivery_status`, `assigned_partner_id`, `delivery_assignment_id`, `pickup_location`, `drop_location`, `delivery_charges`, `estimated_delivery_time`, `delivered_at`).
- `models/PharmacyOrder.js`: Added `deliveryPartner.partnerId`, `deliveryId`, and `deliveryStatus` fields.
- `services/pharmacy/order.service.js`: Added legal status transitions for packing, pickup, and dispatch.
- `server.js`: Mounted delivery routes (`/api/delivery`, `/api/pharmacy`, `/api/consumer`, `/api/admin/delivery`) and delivery socket initialization.

### New Files Created
- `config/deliveryConstants.js`: Enums for partner types, verification statuses, account statuses, vehicle types, delivery modes, and assignment methods.
- `models/delivery/DeliveryPartner.js`: Delivery partner model with GeoJSON location, KYC docs, vehicle, working hours, and rating.
- `models/delivery/PharmacyDeliverySettings.js`: Per-pharmacy delivery configuration.
- `models/delivery/DeliveryAssignment.js`: Audit trail of offers, timeouts, rejections, and assignments.
- `models/delivery/Delivery.js`: Live delivery lifecycle instance with OTP bcrypt hashes and proofs.
- `models/delivery/DeliveryLocationHistory.js`: Real-time breadcrumb coordinates with `2dsphere` index.
- `models/delivery/DeliveryEarning.js`: Financial settlements and payout records.
- `models/delivery/DeliveryNotification.js`: Partner in-app notifications.
- `models/delivery/index.js`: Model exports bundle.
- `utils/deliveryJwt.js`: JWT generator for delivery partner auth and refresh tokens.
- `middleware/delivery/partnerAuth.middleware.js`: Partner authentication and role guard.
- `services/delivery/deliveryAssignmentService.js`: Geospatial candidate ranking, auto-assignment engine with concurrency control, and timeout handler.
- `services/delivery/deliveryService.js`: OTP verification, lifecycle transitions, order status sync, and payout computation.
- `services/delivery/deliveryTrackingService.js`: GPS location ingestion, history recording, and proximity triggers.
- `services/delivery/deliveryNotificationService.js`: Firebase Admin FCM push notifications and Socket.IO alerts.
- `socket/deliveryEvents.js`: Delivery socket initialization, room joins, and broadcasting.
- `controllers/delivery/partnerAuth.controller.js`: Group A Partner Auth endpoints.
- `controllers/delivery/partnerProfile.controller.js`: Group B Profile and KYC endpoints.
- `controllers/delivery/partnerLocation.controller.js`: Group C Availability, GPS, and Earnings endpoints.
- `controllers/delivery/deliveryRequest.controller.js`: Group D Requests feed and accept/reject endpoints.
- `controllers/delivery/deliveryLifecycle.controller.js`: Group E Delivery lifecycle and tracking endpoints.
- `controllers/delivery/pharmacyDelivery.controller.js`: Group F & G Pharmacy staff and assignment endpoints.
- `controllers/delivery/consumerTracking.controller.js`: Group H Consumer tracking endpoints.
- `controllers/delivery/adminDelivery.controller.js`: Group I Admin management endpoints.
- `routes/delivery/partnerAuth.routes.js`: Auth route declarations.
- `routes/delivery/index.js`: Delivery partner route mounts (`/api/delivery`).
- `routes/pharmacy/delivery.routes.js`: Pharmacy delivery route mounts (`/api/pharmacy`).
- `routes/consumer/consumerTracking.routes.js`: Consumer tracking route mounts (`/api/consumer`).
- `routes/admin/adminDelivery.routes.js`: Admin delivery route mounts (`/api/admin/delivery`).
- `tests/delivery/delivery_management.test.js`: Comprehensive 28-test integration suite.
- `generate_delivery_postman_collection.js` & `medisleep_delivery_postman_collection.json`: Postman collection for all 9 API groups.

---

## 3. Database Schemas & Indexes

### Geospatial Indexes
1. `DeliveryPartner`: `current_location: '2dsphere'`
2. `Branch`: `location: '2dsphere'`
3. `Delivery`: `current_location: '2dsphere'`
4. `DeliveryLocationHistory`: `location: '2dsphere'`

### Compound & Performance Indexes
1. `DeliveryPartner`: `{ partner_type: 1, is_online: 1, is_available: 1, account_status: 1 }`
2. `DeliveryPartner`: `{ pharmacy_id: 1, partner_type: 1, account_status: 1 }`
3. `DeliveryAssignment`: `{ delivery_partner_id: 1, assignment_status: 1 }`
4. `DeliveryAssignment`: `{ order_id: 1, assignment_attempt: -1 }`
5. `Delivery`: `{ delivery_partner_id: 1, delivery_status: 1 }`
6. `Delivery`: `{ pharmacy_id: 1, delivery_status: 1 }`
7. `DeliveryLocationHistory`: `{ delivery_id: 1, recorded_at: -1 }`
8. `DeliveryEarning`: `{ partner_id: 1, created_at: -1 }`
9. `DeliveryNotification`: `{ partner_id: 1, read_at: 1, created_at: -1 }`

---

## 4. API Specification Summary (9 Groups)

### Group A: Delivery Partner Authentication
- `POST /api/delivery/auth/register`: Register new platform partner.
- `POST /api/delivery/auth/login`: Authenticate partner (returns JWT & Refresh token).
- `POST /api/delivery/auth/send-otp`: Sends 6-digit OTP to mobile.
- `POST /api/delivery/auth/verify-otp`: Verifies OTP and returns auth session.
- `POST /api/delivery/auth/forgot-password`: Issues password reset token.
- `POST /api/delivery/auth/reset-password`: Sets new password via token.
- `POST /api/delivery/auth/refresh-token`: Issues fresh access token.
- `POST /api/delivery/auth/logout`: Clears device FCM token and sets offline.
- `GET  /api/delivery/auth/me`: Returns current partner profile.

### Group B: Partner Profile & KYC
- `GET  /api/delivery/profile`: Fetches complete profile and pharmacy affiliation.
- `PUT  /api/delivery/profile`: Updates name, photo, and working hours.
- `POST /api/delivery/kyc/upload`: Submits Aadhaar/PAN/DL document for review.
- `GET  /api/delivery/kyc/status`: Checks review status and verified documents.
- `PUT  /api/delivery/vehicle`: Updates vehicle type, plate number, and RC/DL.
- `GET  /api/delivery/account/status`: Checks active/suspended status and workload.

### Group C: Availability & Location
- `PUT  /api/delivery/availability`: Toggle online/offline (requires VERIFIED KYC).
- `POST /api/delivery/location/update`: Ingests GPS point (lat, lon, speed, heading, accuracy).
- `GET  /api/delivery/location/current`: Returns latest recorded GPS coordinates.
- `GET  /api/delivery/earnings/summary`: Returns today's, week's, and total earnings.

### Group D: Delivery Requests Feed
- `GET  /api/delivery/requests`: Lists currently offered delivery dispatches.
- `GET  /api/delivery/requests/:requestId`: Inspects dispatch offer details.
- `POST /api/delivery/requests/:requestId/accept`: Accepts dispatch (concurrency protected).
- `POST /api/delivery/requests/:requestId/reject`: Declines dispatch with reason.
- `GET  /api/delivery/active`: Retrieves current in-transit order.
- `GET  /api/delivery/history`: Paginated history of delivered/failed orders.

### Group E: Delivery Lifecycle
- `POST /api/delivery/:deliveryId/reached-pharmacy`: Marks arrival at pharmacy.
- `POST /api/delivery/:deliveryId/verify-pickup-otp`: Verifies 6-digit pickup OTP.
- `POST /api/delivery/:deliveryId/pickup-confirm`: Confirms pickup with photo proof.
- `POST /api/delivery/:deliveryId/start-delivery`: Starts out-for-delivery journey.
- `POST /api/delivery/:deliveryId/reached-customer`: Marks arrival at customer address.
- `POST /api/delivery/:deliveryId/verify-delivery-otp`: Verifies 6-digit delivery OTP.
- `POST /api/delivery/:deliveryId/complete`: Completes delivery and generates payout.
- `POST /api/delivery/:deliveryId/fail`: Marks failed delivery with reason.
- `POST /api/delivery/:deliveryId/return`: Records return of medicine to pharmacy.
- `GET  /api/delivery/:deliveryId/tracking`: Full tracking and GPS breadcrumbs.

### Group F: Pharmacy Staff Management
- `POST   /api/pharmacy/delivery-staff`: Create/invite delivery staff for branch.
- `GET    /api/pharmacy/delivery-staff`: Lists all delivery staff for branch.
- `GET    /api/pharmacy/delivery-staff/:staffId`: Specific staff details.
- `PUT    /api/pharmacy/delivery-staff/:staffId`: Update staff contact/vehicle.
- `PUT    /api/pharmacy/delivery-staff/:staffId/status`: Activate/suspend staff.
- `DELETE /api/pharmacy/delivery-staff/:staffId`: Deactivate delivery staff.
- `POST   /api/pharmacy/delivery-staff/:staffId/resend-invitation`: Re-issue temp code.

### Group G: Pharmacy Delivery Assignment
- `GET  /api/pharmacy/delivery/settings`: Returns pharmacy delivery config.
- `PUT  /api/pharmacy/delivery/settings`: Updates radius, mode (PLATFORM/STAFF/BOTH).
- `GET  /api/pharmacy/orders/:orderId/delivery-options`: Nearby candidate partners list.
- `POST /api/pharmacy/orders/:orderId/assign-delivery`: Manually assign specific partner.
- `POST /api/pharmacy/orders/:orderId/auto-assign`: Triggers auto-assignment engine.
- `POST /api/pharmacy/orders/:orderId/reassign-delivery`: Reassigns to another partner.
- `POST /api/pharmacy/orders/:orderId/cancel-delivery`: Cancels delivery assignment.
- `GET  /api/pharmacy/deliveries`: Lists all branch deliveries (paginated).

### Group H: Consumer Tracking
- `GET /api/consumer/orders/:orderId/delivery`: Consumer order delivery summary.
- `GET /api/consumer/orders/:orderId/tracking`: Live GPS tracking + drop location.
- `GET /api/consumer/orders/:orderId/delivery-status`: Simple delivery status check.
- `GET /api/consumer/orders/:orderId/delivery-partner`: Masked delivery partner info.

### Group I: Admin Management
- `GET  /api/admin/delivery/partners`: All partners across the platform.
- `GET  /api/admin/delivery/partners/:partnerId`: Detailed partner dossier.
- `PUT  /api/admin/delivery/partners/:partnerId/verify`: Verify/Reject KYC documents.
- `PUT  /api/admin/delivery/partners/:partnerId/status`: Update account status.
- `POST /api/admin/delivery/partners/:partnerId/suspend`: Suspend partner account.
- `GET  /api/admin/delivery/assignments`: Audit trail of all offers & responses.
- `GET  /api/admin/delivery/analytics`: Platform-wide delivery performance metrics.

---

## 5. Real-Time Socket.IO Specification

### Authenticated Rooms
- `partner:{partnerId}`: Partner-specific dispatch offers and personal updates.
- `pharmacy:{pharmacyId}`: Pharmacy-wide alerts, partner arrival, pickup, and completion.
- `consumer:{consumerId}`: Real-time order progress and live courier location.
- `delivery:{deliveryId}`: Active delivery breadcrumb streaming.

### Client-to-Server Events
- `join_delivery_room`: `{ room: "partner:60d...", token: "JWT" }`
- `leave_delivery_room`: `{ room: "partner:60d..." }`

### Server-to-Client Events
| Event Name | Room | Payload |
| :--- | :--- | :--- |
| `delivery_request_new` | `partner:{id}` | `{ assignmentId, orderId, orderNumber, pharmacyName, pickupAddress, dropAddress, distanceKm, timeoutSeconds }` |
| `delivery_request_expired` | `partner:{id}` | `{ assignmentId, orderId, message }` |
| `delivery_assigned` | `partner:{id}`<br>`pharmacy:{id}` | `{ deliveryId, orderId, partnerName, pickupOtpCode, deliveryStatus }` |
| `delivery_tracking_update` | `delivery:{id}`<br>`consumer:{id}` | `{ deliveryId, latitude, longitude, speed, heading, accuracy, updatedAt }` |
| `delivery_reached_pharmacy` | `pharmacy:{id}` | `{ deliveryId, orderId, message }` |
| `delivery_pickup_confirmed` | `pharmacy:{id}` | `{ deliveryId, orderId, message }` |
| `delivery_started` | `consumer:{id}`<br>`pharmacy:{id}` | `{ deliveryId, orderId, message }` |
| `delivery_reached_customer` | `consumer:{id}` | `{ deliveryId, orderId, message }` |
| `delivery_completed` | `partner:{id}`<br>`pharmacy:{id}`<br>`consumer:{id}` | `{ deliveryId, orderId, deliveredAt, netAmount }` |
| `delivery_failed` | `pharmacy:{id}` | `{ deliveryId, orderId, reason }` |

---

## 6. Firebase FCM Notification Implementation

- Implemented in `services/delivery/deliveryNotificationService.js` using Firebase Admin Messaging.
- Dual-channel delivery:
  - **Foreground**: Instant UI update via Socket.IO.
  - **Background / Killed**: Native heads-up notification with sound and high-priority channel (`delivery_alerts`).

---

## 7. Assignment Engine Algorithm

```
Step 1: Check Order Readiness (Status: PACKED / READY_FOR_PICKUP)
Step 2: Read Pharmacy Delivery Settings (Delivery Mode, Radius, Timeout)
Step 3: Discover Eligible Candidate Partners:
        Filter:
          - account_status === 'ACTIVE'
          - verification_status === 'VERIFIED'
          - is_online === true
          - is_available === true
          - activeDeliveries < max_active_deliveries_per_partner
          - Scope check:
            * OWN_STAFF: partner.pharmacy_id === order.branch_id
            * PLATFORM: partner.partner_type === 'PLATFORM_PARTNER'
            * BOTH: Union of both (own staff given priority score boost)
Step 4: Rank Candidates:
        Score = Distance (km) + (ActiveLoad * 1.5) + (isOwnStaff ? -1.0 : 0)
Step 5: Pick Top Candidate and Atomically Create DeliveryAssignment (Status: OFFERED)
Step 6: Emit Socket event `delivery_request_new` + Send FCM Push
Step 7: Start Timeout Timer (configurable, default: 45s - 60s)
Step 8: If Accepted -> Transition to ASSIGNED, generate OTP hashes, lock delivery
Step 9: If Rejected/Expired -> Mark assignment status, iterate to next candidate
Step 10: If All Candidates Exhausted -> Emit `delivery_failed` to pharmacy for manual assignment
```

---

## 8. Flutter Integration Contract

### Dart Model: `DeliveryPartner`
```dart
class DeliveryPartner {
  final String id;
  final String partnerCode;
  final String partnerType; // 'PLATFORM_PARTNER' | 'PHARMACY_STAFF'
  final String fullName;
  final String email;
  final String mobile;
  final String vehicleType;
  final String? vehicleNumber;
  final bool isOnline;
  final bool isAvailable;
  final double rating;

  DeliveryPartner({
    required this.id,
    required this.partnerCode,
    required this.partnerType,
    required this.fullName,
    required this.email,
    required this.mobile,
    required this.vehicleType,
    this.vehicleNumber,
    required this.isOnline,
    required this.isAvailable,
    required this.rating,
  });

  factory DeliveryPartner.fromJson(Map<String, dynamic> json) {
    return DeliveryPartner(
      id: json['id'] ?? json['_id'],
      partnerCode: json['partner_code'] ?? '',
      partnerType: json['partner_type'] ?? 'PLATFORM_PARTNER',
      fullName: json['full_name'] ?? '',
      email: json['email'] ?? '',
      mobile: json['mobile'] ?? '',
      vehicleType: json['vehicle_type'] ?? 'MOTORCYCLE',
      vehicleNumber: json['vehicle_number'],
      isOnline: json['is_online'] ?? false,
      isAvailable: json['is_available'] ?? true,
      rating: (json['rating']?['average'] ?? 5.0).toDouble(),
    );
  }
}
```

### Dart Model: `DeliveryTracking`
```dart
class DeliveryTracking {
  final String deliveryId;
  final String orderId;
  final String deliveryStatus;
  final bool trackingAvailable;
  final double? latitude;
  final double? longitude;
  final String? partnerName;
  final String? partnerPhone;

  DeliveryTracking({
    required this.deliveryId,
    required this.orderId,
    required this.deliveryStatus,
    required this.trackingAvailable,
    this.latitude,
    this.longitude,
    this.partnerName,
    this.partnerPhone,
  });

  factory DeliveryTracking.fromJson(Map<String, dynamic> json) {
    final coords = json['currentLocation']?['coordinates'];
    return DeliveryTracking(
      deliveryId: json['deliveryId'] ?? '',
      orderId: json['orderId'] ?? '',
      deliveryStatus: json['deliveryStatus'] ?? 'PENDING',
      trackingAvailable: json['trackingAvailable'] ?? false,
      latitude: coords != null ? coords[1].toDouble() : null,
      longitude: coords != null ? coords[0].toDouble() : null,
      partnerName: json['partner']?['name'],
      partnerPhone: json['partner']?['phone'],
    );
  }
}
```

---

## 9. Test Verification Report

- Executed automated integration test suite: `tests/delivery/delivery_management.test.js`
- **Results**: 28 passed, 0 failed, 100% test success rate.
- **Regression Suite**: `tests/admin.test.js` & `tests/auth.test.js` executed with 0 failures, ensuring complete backwards compatibility with existing patient, doctor, MR, and admin endpoints.

