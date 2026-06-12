# HealthCare+ Backend

A complete Node.js + Express + MongoDB healthcare backend application with JWT-based email/password authentication.

## Features

- **User Management**: Role-based authentication (Patient, Doctor, Medical Representative, Admin)
- **Patient Module**: Profile management, doctor search, appointment booking, prescriptions, pharmacy orders, health tracking
- **Doctor Module**: Profile management, schedule management, appointment handling, prescription writing, patient management
- **Medical Representative Module**: Doctor directory, meeting requests, visit planning, DCR submission, sample management
- **Security**: JWT authentication, role-based access control, input validation, rate limiting
- **Database**: MongoDB with Mongoose ODM

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi
- **Security**: Helmet, CORS, bcryptjs
- **Logging**: Morgan
- **Environment**: dotenv

## Project Structure

```
healthcare-backend/
├── config/
│   ├── database.js
│   ├── constants.js
│   └── environment.js
├── controllers/
│   ├── authController.js
│   ├── patientController.js
│   ├── doctorController.js
│   └── mrController.js
├── models/
│   ├── User.js
│   ├── Patient.js
│   ├── Doctor.js
│   ├── MedicalRep.js
│   ├── Appointment.js
│   ├── Prescription.js
│   ├── PharmacyOrder.js
│   ├── HealthMetric.js
│   └── MRMeetings.js
├── routes/
│   ├── authRoutes.js
│   ├── patientRoutes.js
│   ├── doctorRoutes.js
│   └── mrRoutes.js
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   ├── errorHandler.js
│   └── roleAuth.js
├── utils/
│   ├── validators.js
│   ├── helpers.js
│   └── errorResponse.js
├── tests/
├── .env.example
├── server.js
├── seed.js
└── package.json
```

## Installation & Setup

### 1. Prerequisites

- Node.js (v18+)
- MongoDB (local or cloud)
- npm or yarn

### 2. Clone & Install

```bash
git clone <repository-url>
cd healthcare-backend
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Update `.env` with your configurations:

```env
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb://localhost:27017/healthcare_db

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_EXPIRY=7d
JWT_REFRESH_EXPIRY=30d

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=healthcare@example.com

CLIENT_URL=http://localhost:3000
```

### 4. Database Setup

Make sure MongoDB is running, then seed the database:

```bash
npm run seed
```

### 5. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

The server will run on `http://localhost:5000`

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login user |
| POST | `/auth/refresh-token` | Refresh access token |
| POST | `/auth/logout` | Logout user |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update current user |

### Profile Completion Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/complete-profile/patient` | Complete patient profile |
| POST | `/auth/complete-profile/doctor` | Complete doctor profile |
| POST | `/auth/complete-profile/mr` | Complete MR profile |

### Patient Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients/profile` | Get patient profile |
| PUT | `/patients/profile` | Update patient profile |
| GET | `/patients/doctors` | Search doctors |
| GET | `/patients/doctors/:id` | Get doctor details |
| POST | `/patients/appointments` | Book appointment |
| GET | `/patients/appointments` | Get patient appointments |
| GET | `/patients/appointments/:id` | Get appointment details |
| DELETE | `/patients/appointments/:id` | Cancel appointment |
| GET | `/patients/prescriptions` | Get patient prescriptions |
| GET | `/patients/prescriptions/:id` | Get prescription details |
| POST | `/patients/pharmacy-orders` | Create pharmacy order |
| GET | `/patients/pharmacy-orders` | Get pharmacy orders |
| POST | `/patients/health-tracking` | Log health metric |
| GET | `/patients/health-tracking` | Get health metrics |
| GET | `/patients/health-tracking/statistics` | Get health statistics |
| GET | `/patients/emergency-contacts` | Get emergency contacts |
| PUT | `/patients/emergency-contacts` | Update emergency contact |

### Doctor Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/doctors/profile` | Get doctor profile |
| PUT | `/doctors/profile` | Update doctor profile |
| GET | `/doctors/schedule` | Get doctor schedule |
| PUT | `/doctors/schedule` | Update doctor schedule |
| GET | `/doctors/dashboard` | Get doctor dashboard |
| GET | `/doctors/appointments` | Get doctor appointments |
| GET | `/doctors/appointments/:id` | Get appointment details |
| PUT | `/doctors/appointments/:id/complete` | Complete appointment |
| GET | `/doctors/patients` | Get doctor's patients |
| POST | `/doctors/prescriptions` | Create prescription |
| GET | `/doctors/prescriptions` | Get doctor prescriptions |
| GET | `/doctors/mr-meetings` | Get MR meeting requests |
| POST | `/doctors/mr-meetings/:id/approve` | Approve MR meeting |
| POST | `/doctors/mr-meetings/:id/reject` | Reject MR meeting |

### Medical Representative Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mr/profile` | Get MR profile |
| PUT | `/mr/profile` | Update MR profile |
| GET | `/mr/doctors` | Get doctors in territory |
| GET | `/mr/doctors/:id` | Get doctor details with history |
| POST | `/mr/meeting-requests` | Request meeting with doctor |
| GET | `/mr/meeting-requests` | Get meeting requests |
| GET | `/mr/visit-plan` | Get visit plan |
| POST | `/mr/dcr` | Submit DCR |
| GET | `/mr/dcr` | Get DCR list |
| GET | `/mr/samples` | Get sample inventory |
| POST | `/mr/samples/distribute` | Distribute samples |
| GET | `/mr/analytics` | Get territory analytics |
| GET | `/mr/expenses` | Get expense report |

## Sample Login Credentials

After running the seed script, you can use these credentials:

- **Patient**: `john.doe@email.com` / `Password123!`
- **Doctor**: `dr.smith@hospital.com` / `Password123!`
- **Medical Representative**: `mr.jones@pharma.com` / `Password123!`
- **Admin**: `admin@healthcare.com` / `Password123!`

## Request/Response Format

### Standard Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Standard Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

### Authentication Required
All protected routes require the Authorization header:
```
Authorization: Bearer <jwt-token>
```

## Validation Rules

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Email Format
- Must be a valid email address
- Must be unique in the system

### Phone Format
- International format supported
- Pattern: `+1234567890` or `1234567890`

## Error Codes

| Status | Description |
|--------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Different permissions for each user role
- **Password Hashing**: bcryptjs for secure password storage
- **Input Validation**: Joi validation for all inputs
- **Rate Limiting**: Express rate limiting to prevent abuse
- **CORS**: Configured for cross-origin requests
- **Helmet**: Security headers for Express
- **Environment Variables**: Sensitive data in environment variables

## Health Check

Check if the API is running:
```
GET /api/health
```

Response:
```json
{
  "success": true,
  "message": "HealthCare+ Backend is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

## Testing

Run tests:
```bash
npm test
```

## Development Scripts

```bash
# Start development server with nodemon
npm run dev

# Start production server
npm start

# Seed database with sample data
npm run seed

# Run tests
npm test
```

## Deployment

### Environment Variables for Production

Make sure to set these environment variables in production:

- `NODE_ENV=production`
- `JWT_SECRET` (use a strong, unique secret)
- `MONGODB_URI` (your production MongoDB connection string)
- `SMTP_*` (email service configuration)
- `CLIENT_URL` (your frontend URL)

### Database Indexes

The application automatically creates necessary indexes for performance. Key indexes include:

- User email (unique)
- Doctor specialization and city
- Appointment date and status
- Patient health metrics by type and date
- MR territory and company

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.