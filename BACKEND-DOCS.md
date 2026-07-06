# HealthCare+ Backend Auth Module Specifications

This document defines the architecture, database models, endpoints, and API design for the HealthCare+ role-based authentication and authorization system. 

---

## 1. Project Overview

The HealthCare+ Backend is built on **Node.js, Express, and MongoDB (via Mongoose)**. The backend supports three main user roles: **Doctor**, **Patient**, and **Medical Representative (MR)**.

### Directory Structure

The role-based authentication is modularized under the following structure:
- `controllers/auth/`
  - `doctor/doctorController.js` (Complete Implementation)
  - `patient/patientController.js` (Structure / Placeholder)
  - `mr/mrController.js` (Structure / Placeholder)
- `routes/auth/`
  - `doctor/doctorRoutes.js` (Complete Route Mapping + Multer Config)
  - `patient/patientRoutes.js` (Placeholder routes)
  - `mr/mrRoutes.js` (Placeholder routes)

---

## 2. Database Schema Definition

### User Model (`User.js`)
Stores authentication credentials for all users:

| Field Name | Type | Required | Default Value | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `email` | String | Yes | - | Unique, lowercase, validated using email pattern regex |
| `password` | String | Yes | - | Hashed using `bcryptjs` (salt rounds: 10) |
| `role` | String | Yes | `'patient'` | Enum: `['patient', 'doctor', 'mr', 'admin']` |
| `status` | String | Yes | `'active'` | Enum: `['active', 'inactive', 'suspended']` |
| `profileComplete`| Boolean| Yes | `false` | Sets to `true` when role-specific profile is complete |
| `lastLogin` | Date | No | `Date.now` | Updated automatically on successful login |

### Doctor Model (`Doctor.js`)
Linked 1-to-1 to the `User` model, storing professional details and credentials:

| Field Name | Type | Required | Default Value | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | ObjectId | Yes | - | References `User` model, unique index |
| `firstName` | String | Yes | - | Extracted from full name |
| `lastName` | String | Yes | - | Extracted from full name |
| `specialization` | String | Yes | - | e.g., 'Cardiologist', 'Dermatologist' |
| `licenseNumber` | String | Yes | - | Medical Registration Number (unique) |
| `yearsExperience`| Number | Yes | - | Years of medical practice |
| `clinic.name` | String | Yes | - | Name of clinic/hospital |
| `clinic.address`| String | Yes | - | Address of clinic/hospital |
| `clinic.city` | String | Yes | `'Default City'`| City location of the clinic |
| `clinic.phone` | String | Yes | - | Formatted clinic phone, e.g. `+91XXXXXXXXXX` |
| `consultationFee`| Number | Yes | `500` | Consultation charges |
| `verificationStatus`| String| Yes | `'pending'` | Enum: `['pending', 'verified', 'rejected']` |
| `profilePicture`| String | No | - | Server file path to profile image |
| `verificationDocuments`| Array | No | `[]` | List of `{ documentType, documentUrl, uploadedAt }` |

---

## 3. JWT Authentication Flow

Auth works using **JSON Web Tokens (JWT)**.
- **Login/Registration Response**: Successful authentication yields an `token` (Access Token) and `refreshToken`.
- **Protected Requests**: Client must attach the token in the `Authorization` header as:
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  ```
- **Middleware Check**: The `protect` middleware decodes the token, checks if the user exists, is active, and populates `req.user` with the User model document.
- **Role Authorization**: The `authorize(...roles)` middleware verifies if the user's role is permitted to call the protected API.

---

## 4. File Upload Configuration (Multer)

All files are stored in the local server folder `/uploads/`.
- **Max file size**: `5MB`
- **Allowed file types (MIME)**: `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`
- **Fields**:
  - `profilePhoto` (only images)
  - `govId` (images or PDF)
  - `degree` (images or PDF)
  - `councilId` (images or PDF)

---

## 5. Doctor Authentication APIs

### 1. Doctor Registration
Registers user, creates doctor profile, and uploads verification files.

- **Method**: `POST`
- **URL**: `/api/auth/doctor/register`
- **Headers**: `Content-Type: multipart/form-data`
- **Request Body (Multipart-form)**:
  - `fullName`: String (e.g. `Dr. Ramesh Kumar`)
  - `email`: String (e.g. `ramesh@hospital.com`)
  - `password`: String (e.g. `Pass1234`)
  - `phone`: String (e.g. `9876543210`)
  - `licenseNumber`: String (e.g. `MCI-12345`)
  - `registrationCouncil`: String (e.g. `Delhi Medical Council`)
  - `qualification`: String (e.g. `MBBS, MD`)
  - `specialization`: String (e.g. `Cardiologist`)
  - `yearsExperience`: Number (e.g. `12`)
  - `clinicName`: String (e.g. `Metro Cardiac Clinic`)
  - `clinicAddress`: String (e.g. `12 Ring Road, Lajpat Nagar`)
  - `city`: String (Optional, e.g. `New Delhi`)
  - `consultationFee`: Number (Optional, e.g. `600`)
  - Files to upload (binary):
    - `profilePhoto` (Required, image format)
    - `govId` (Required, Govt ID proof Aadhar/PAN in image/PDF format)
    - `degree` (Required, Medical Degree Certificate in image/PDF format)
    - `councilId` (Required, Medical Council ID Card in image/PDF)

- **Response Success (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Doctor registered successfully. Approval is pending.",
    "data": {
      "userId": "60c72b2f9b1d8a001c8d4b30",
      "doctorId": "60c72b2f9b1d8a001c8d4b31",
      "fullName": "Ramesh Kumar",
      "email": "ramesh@hospital.com",
      "role": "doctor",
      "verificationStatus": "pending",
      "profilePicture": "/uploads/profilePhoto-1623755055000.jpg"
    },
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```
- **Response Error (400 Bad Request)**:
  ```json
  {
    "success": false,
    "error": "Medical Registration / License number already registered"
  }
  ```

### 2. Doctor Login
Authenticates doctor credentials and returns JWT token.

- **Method**: `POST`
- **URL**: `/api/auth/doctor/login`
- **Headers**: `Content-Type: application/json`
- **Request Body (JSON)**:
  ```json
  {
    "email": "ramesh@hospital.com",
    "password": "Password123"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "userId": "60c72b2f9b1d8a001c8d4b30",
      "doctorId": "60c72b2f9b1d8a001c8d4b31",
      "fullName": "Ramesh Kumar",
      "email": "ramesh@hospital.com",
      "role": "doctor",
      "verificationStatus": "pending",
      "profilePicture": "/uploads/profilePhoto-1623755055000.jpg"
    },
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```

### 3. Get Doctor Profile
Returns the profile details of the authenticated doctor.

- **Method**: `GET`
- **URL**: `/api/auth/doctor/profile`
- **Headers**: `Authorization: Bearer <token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "60c72b2f9b1d8a001c8d4b31",
      "userId": {
        "_id": "60c72b2f9b1d8a001c8d4b30",
        "email": "ramesh@hospital.com",
        "role": "doctor"
      },
      "firstName": "Ramesh",
      "lastName": "Kumar",
      "specialization": "Cardiologist",
      "licenseNumber": "MCI-12345",
      "yearsExperience": 12,
      "clinic": {
        "name": "Metro Cardiac Clinic",
        "address": "12 Ring Road, Lajpat Nagar",
        "city": "New Delhi",
        "phone": "+919876543210"
      },
      "consultationFee": 600,
      "verificationStatus": "pending",
      "profilePicture": "/uploads/profilePhoto-1623755055000.jpg",
      "verificationDocuments": [
        { "documentType": "govId", "documentUrl": "/uploads/govId-1623755055000.pdf" }
      ]
    }
  }
  ```

### 4. Update Doctor Profile
Allows updates to clinic details, specialization, experience, and profile picture.

- **Method**: `PUT`
- **URL**: `/api/auth/doctor/profile`
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Request Body (Multipart-form, all fields optional)**:
  - `fullName`: String
  - `specialization`: String
  - `yearsExperience`: Number
  - `clinicName`: String
  - `clinicAddress`: String
  - `city`: String
  - `phone`: String
  - `bio`: String
  - File to upload:
    - `profilePhoto` (image)
- **Response Success (200 OK)**: Contains updated doctor profile model response.

### 5. Get Doctor Verification Status
Checks if the doctor profile has been verified.

- **Method**: `GET`
- **URL**: `/api/auth/doctor/status`
- **Headers**: `Authorization: Bearer <token>`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "verificationStatus": "pending"
    }
  }
  ```

### 6. Update Doctor Verification Status (Admin)
Allows the administrator to approve or reject a doctor's pending verification status.

- **Method**: `PUT`
- **URL**: `/api/auth/doctor/status`
- **Headers**: `Authorization: Bearer <token>` (Admin or active doctor)
- **Request Body (JSON)**:
  ```json
  {
    "doctorId": "60c72b2f9b1d8a001c8d4b31",
    "status": "verified"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Doctor verification status updated to verified successfully.",
    "data": {
      "doctorId": "60c72b2f9b1d8a001c8d4b31",
      "fullName": "Ramesh Kumar",
      "verificationStatus": "verified"
    }
  }
  ```

---

## 6. Sibling Role APIs (Pending Implementation)

The following route endpoints have folder structures and empty controller shells ready, but their validation and database mappings remain unimplemented:

- **Patient APIs**:
  - `POST /api/auth/patient/register`
  - `POST /api/auth/patient/login`
- **MR APIs**:
  - `POST /api/auth/mr/register`
  - `POST /api/auth/mr/login`

All logic and schemas for Patient & MR are listed under **Pending Implementation** and will be detailed during their subsequent build phases.
