// Pharmacy login rules: approval, block/deactivate, lockout after 5 failures.
const bcrypt = require('bcryptjs');
const { User } = require('../../models/pharmacy');
const auth = require('../../services/pharmacy/auth.service');
const { makeStore, expectApiError } = require('./helpers');

let n = 0;
const makeUser = async (over = {}) => {
    n += 1;
    const { branch } = await makeStore();
    const email = `login${n}@test.local`;
    await User.create({
        full_name: 'Login Tester',
        email,
        phone: `90000${String(n).padStart(5, '0')}`,
        password_hash: await bcrypt.hash('Medislip@123', 4),
        role: 'PHARMACY_OWNER',
        branch_id: branch._id,
        approval_status: 'approved',
        is_active: true,
        ...over,
    });
    return email;
};

describe('loginUser', () => {
    test('approved owner logs in (email is case-insensitive)', async () => {
        const email = await makeUser();
        const r = await auth.loginUser(email.toUpperCase(), 'Medislip@123');
        expect(typeof r.accessToken).toBe('string');
        expect(r.user.email).toBe(email);
        expect(r.user.password_hash).toBeUndefined();
    });

    test('unknown email and wrong password give the same 401', async () => {
        const email = await makeUser();
        await expectApiError(auth.loginUser('nobody@test.local', 'x'), 'INVALID_CREDENTIALS', 401);
        await expectApiError(auth.loginUser(email, 'Wrong@123'), 'INVALID_CREDENTIALS', 401);
        expect((await User.findOne({ email })).failed_login_attempts).toBe(1);
    });

    test('5 failed attempts lock the account, even for the right password', async () => {
        const email = await makeUser();
        for (let i = 0; i < 5; i++) {
            await expectApiError(auth.loginUser(email, 'Wrong@123'), 'INVALID_CREDENTIALS', 401);
        }
        await expectApiError(auth.loginUser(email, 'Medislip@123'), 'ACCOUNT_LOCKED', 423);
        const u = await User.findOne({ email });
        expect(u.lock_until.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    });

    test('a successful login resets the failure counter', async () => {
        const email = await makeUser();
        await expectApiError(auth.loginUser(email, 'Wrong@123'), 'INVALID_CREDENTIALS');
        await auth.loginUser(email, 'Medislip@123');
        expect((await User.findOne({ email })).failed_login_attempts).toBe(0);
    });

    test('expired lock lets the user in again', async () => {
        const email = await makeUser({ failed_login_attempts: 5, lock_until: new Date(Date.now() - 1000) });
        await expect(auth.loginUser(email, 'Medislip@123')).resolves.toHaveProperty('accessToken');
    });

    test.each([
        ['pending approval', { approval_status: 'pending' }, 'ACCOUNT_PENDING_APPROVAL'],
        ['rejected', { approval_status: 'rejected' }, 'ACCOUNT_REJECTED'],
        ['blocked', { is_blocked: true }, 'ACCOUNT_BLOCKED'],
        ['deactivated staff', { role: 'PHARMACIST', is_active: false }, 'ACCOUNT_DEACTIVATED'],
    ])('%s cannot log in', async (_label, over, code) => {
        const email = await makeUser(over);
        await expectApiError(auth.loginUser(email, 'Medislip@123'), code, 403);
    });
});
