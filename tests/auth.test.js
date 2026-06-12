const request = require('supertest');
const app = require('../server');

describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Password123!',
                confirmPassword: 'Password123!',
                role: 'patient'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(userData.email);
            expect(response.body.token).toBeDefined();
        });

        it('should not register user with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'Password123!',
                confirmPassword: 'Password123!',
                role: 'patient'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should not register user with weak password', async () => {
            const userData = {
                email: 'test2@example.com',
                password: '123',
                confirmPassword: '123',
                role: 'patient'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'john.doe@email.com',
                password: 'Password123!'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.data.email).toBe(loginData.email);
        });

        it('should not login with invalid credentials', async () => {
            const loginData = {
                email: 'john.doe@email.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/auth/me', () => {
        let token;

        beforeAll(async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'john.doe@email.com',
                    password: 'Password123!'
                });

            token = loginResponse.body.token;
        });

        it('should get current user profile', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user).toBeDefined();
        });

        it('should not get profile without token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });
});