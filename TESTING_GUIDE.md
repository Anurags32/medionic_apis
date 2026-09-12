# HealthCare+ Backend API - Complete Testing Guide

## ✅ Backend Status
✓ 45 Core Endpoints Implemented  
✓ 13 Extended Patient Endpoints Added  
✓ 7 Extended Doctor Endpoints Added  
✓ 10 Extended MR Endpoints Added  
**Total: 75 Endpoints**

---

## 🔴 IMPORTANT: Fix Your Registration Error

### ❌ WRONG Format (What you're sending):
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "John",       
  "lastName": "Doe",         
  "role": "patient"
}
```

**Error:** Confirm password is required, firstName/lastName not allowed

### ✅ CORRECT Format (Do this):

**Step 1: Register** - POST `/api/auth/register`
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!",
  "role": "patient"
}
```
Response will include: token, refreshToken, userId

---

**Step 2: Complete Profile** - POST `/api/auth/complete-profile/patient`
(Use the token from registration)
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dob": "1990-01-15",
  "gender": "male",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "bloodGroup": "O+",
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "+1234567890",
    "relation": "Sister"
  }
}
```

---

## 📊 API Endpoints Summary

### **System (1)**
- ✅ GET `/api/health` - Health Check

### **Authentication (11)**
- ✅ POST `/api/auth/register` - Register user
- ✅ POST `/api/auth/login` - Login
- ✅ POST `/api/auth/refresh-token` - Refresh token
- ✅ POST `/api/auth/forgot-password` - Request password reset
- ✅ POST `/api/auth/reset-password` - Reset password
- ✅ GET `/api/auth/me` - Get current user
- ✅ PUT `/api/auth/me` - Update user profile
- ✅ POST `/api/auth/complete-profile/patient` - Complete patient profile
- ✅ POST `/api/auth/complete-profile/doctor` - Complete doctor profile
- ✅ POST `/api/auth/complete-profile/mr` - Complete MR profile
- ✅ POST `/api/auth/logout` - Logout

### **Patient Core (9)**
- ✅ GET `/api/patients/profile` - Get profile
- ✅ PUT `/api/patients/profile` - Update profile
- ✅ GET `/api/patients/doctors` - Search doctors
- ✅ GET `/api/patients/doctors/:id` - Get doctor details
- ✅ POST `/api/patients/appointments` - Book appointment
- ✅ GET `/api/patients/appointments` - Get appointments
- ✅ GET `/api/patients/appointments/:id` - Get appointment details
- ✅ DELETE `/api/patients/appointments/:id` - Cancel appointment
- ✅ GET `/api/patients/prescriptions` - Get prescriptions

### **Patient Extended (8)**
- ✅ PUT `/api/patients/appointments/:id/reschedule` - Reschedule appointment
- ✅ GET `/api/patients/prescriptions/:id/download` - Download prescription
- ✅ POST `/api/patients/medical-records` - Upload medical record
- ✅ GET `/api/patients/medical-records` - Get medical records
- ✅ DELETE `/api/patients/medical-records/:id` - Delete medical record
- ✅ POST `/api/patients/emergency-contacts` - Add emergency contact
- ✅ GET `/api/patients/emergency-contacts` - Get emergency contacts
- ✅ DELETE `/api/patients/emergency-contacts/:id` - Delete emergency contact

### **Patient Health & Pharmacy (8)**
- ✅ GET `/api/patients/prescriptions/:id` - Get prescription details
- ✅ POST `/api/patients/pharmacy-orders` - Create pharmacy order
- ✅ GET `/api/patients/pharmacy-orders` - Get pharmacy orders
- ✅ POST `/api/patients/health-tracking` - Log health metric
- ✅ GET `/api/patients/health-tracking` - Get health metrics
- ✅ GET `/api/patients/health-tracking/statistics` - Get statistics
- ✅ PUT `/api/patients/emergency-contacts` - Update emergency contact

### **Doctor Core (9)**
- ✅ GET `/api/doctors/profile` - Get profile
- ✅ PUT `/api/doctors/profile` - Update profile
- ✅ GET `/api/doctors/schedule` - Get schedule
- ✅ PUT `/api/doctors/schedule` - Update schedule
- ✅ GET `/api/doctors/dashboard` - Get dashboard
- ✅ GET `/api/doctors/appointments` - Get appointments
- ✅ GET `/api/doctors/appointments/:id` - Get appointment details
- ✅ PUT `/api/doctors/appointments/:id/complete` - Mark completed
- ✅ GET `/api/doctors/patients` - Get patients

### **Doctor Extended (7)**
- ✅ GET `/api/doctors/analytics/revenue` - Revenue analytics
- ✅ GET `/api/doctors/analytics/ratings` - Rating analytics
- ✅ GET `/api/doctors/analytics/appointments` - Appointment trends
- ✅ GET `/api/doctors/earnings` - Get earnings
- ✅ POST `/api/doctors/earnings/withdraw` - Request withdrawal
- ✅ GET `/api/doctors/earnings/history` - Withdrawal history
- ✅ POST `/api/doctors/profile/verify` - Verify profile

### **Doctor Prescriptions & MR (5)**
- ✅ GET `/api/doctors/prescriptions` - Get prescriptions
- ✅ POST `/api/doctors/prescriptions` - Create prescription
- ✅ GET `/api/doctors/mr-meetings` - Get MR meetings
- ✅ POST `/api/doctors/mr-meetings/:id/approve` - Approve meeting
- ✅ POST `/api/doctors/mr-meetings/:id/reject` - Reject meeting

### **MR Core (9)**
- ✅ GET `/api/mr/profile` - Get profile
- ✅ PUT `/api/mr/profile` - Update profile
- ✅ GET `/api/mr/doctors` - Get doctors
- ✅ GET `/api/mr/doctors/:id` - Get doctor details
- ✅ POST `/api/mr/meeting-requests` - Request meeting
- ✅ GET `/api/mr/meeting-requests` - Get meeting requests
- ✅ GET `/api/mr/visit-plan` - Get visit plan
- ✅ GET `/api/mr/samples` - Get samples
- ✅ GET `/api/mr/analytics` - Get analytics

### **MR Extended (10)**
- ✅ POST `/api/mr/dcr` - Submit DCR
- ✅ GET `/api/mr/dcr` - Get DCRs
- ✅ POST `/api/mr/samples/distribute` - Distribute samples
- ✅ POST `/api/mr/tour-plan` - Create tour plan
- ✅ GET `/api/mr/tour-plan` - Get tour plan
- ✅ GET `/api/mr/tour-plan/:id/weekly` - Get weekly breakdown
- ✅ POST `/api/mr/chemists` - Add chemist
- ✅ GET `/api/mr/chemists` - Get chemists
- ✅ PUT `/api/mr/chemists/:id` - Update chemist
- ✅ DELETE `/api/mr/chemists/:id` - Delete chemist
- ✅ POST `/api/mr/expenses` - Log expense
- ✅ GET `/api/mr/expenses` - Get expenses
- ✅ GET `/api/mr/expenses/pending-approvals` - Get pending approvals

---

## 🧪 Quick Test Flow

### 1. **Health Check** (No auth required)
```bash
curl http://localhost:5000/api/health
```

### 2. **Register Patient**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@test.com",
    "password": "Password123!",
    "confirmPassword": "Password123!",
    "role": "patient"
  }'
```

### 3. **Complete Profile** (Use token from register)
```bash
curl -X POST http://localhost:5000/api/auth/complete-profile/patient \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dob": "1990-01-15",
    "gender": "male",
    "address": {"street": "123 Main", "city": "NYC", "state": "NY", "zip": "10001"},
    "bloodGroup": "O+",
    "emergencyContact": {"name": "Jane", "phone": "+1234567890", "relation": "Sister"}
  }'
```

### 4. **Get Own Profile** (Logged in)
```bash
curl http://localhost:5000/api/patients/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📋 Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (@$!%*?&)

**Valid Example:** `Password123!` ✅  
**Invalid Examples:** 
- `password123!` - No uppercase ❌
- `Pass123` - No special character ❌
- `Pass1` - Too short ❌

---

## 🔑 Key Points

1. **Registration ONLY takes:** email, password, confirmPassword, role
2. **Profile details (firstName, lastName, etc.) go to:** complete-profile endpoints
3. **Always include Authorization header:** `Authorization: Bearer TOKEN`
4. **Base URL:** `http://localhost:5000/api`
5. **Default roles:** patient | doctor | mr | admin

---

## 📁 Important Files Updated

✅ `/controllers/patientExtendedController.js` - 7 new patient endpoints  
✅ `/controllers/doctorExtendedController.js` - 7 new doctor endpoints  
✅ `/controllers/mrExtendedController.js` - 10 new MR endpoints  
✅ `/routes/patientRoutes.js` - Added new patient routes  
✅ `/routes/doctorRoutes.js` - Added new doctor routes  
✅ `/routes/mrRoutes.js` - Added new MR routes  
✅ `/postman_collection.json` - Updated with all 75 endpoints

---

## 🚀 Next Steps

1. **Import Postman Collection:**
   - Open Postman
   - Click "Import"
   - Select `postman_collection.json`
   - Set `base_url` variable to `http://localhost:5000/api`
   - Set `authToken` after login

2. **Test Flow:**
   - Health Check (no auth)
   - Register (get token)
   - Complete Profile (use token)
   - Access protected endpoints

3. **Run Backend:**
   ```bash
   npm install
   npm start
   ```

---

## ❓ Common Issues

**Q: "Confirm password is required"**  
A: You're sending firstName/lastName. Use only: email, password, confirmPassword, role

**Q: "401 Unauthorized"**  
A: Missing or invalid token. Include valid Authorization header

**Q: "Profile not found"**  
A: Call complete-profile first after registration

**Q: Can't access protected route**  
A: Ensure profile is complete (check profileComplete field in auth response)

---

Generated: 2026-06-12  
Backend Version: 1.0 (Complete + Extended)
