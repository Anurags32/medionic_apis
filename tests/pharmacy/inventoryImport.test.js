// Excel / CSV bulk import: date parsing, header aliases, create vs add-batch.
const { Medicine, MedicineBatch, Category } = require('../../models/pharmacy');
const inventoryService = require('../../services/pharmacy/inventory.service');
const { makeStore, expectApiError } = require('./helpers');

const ymd = (d) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

describe('parseImportDate', () => {
    const p = inventoryService.parseImportDate;
    test.each([
        ['2027-03-31', '2027-3-31'],
        ['31/03/2027', '2027-3-31'],
        ['31-03-27', '2027-3-31'],
        ['03/2027', '2027-3-31'],
        ['3-27', '2027-3-31'],
        ['Mar 2027', '2027-3-31'],
        ['MAR-27', '2027-3-31'],
        ['2027/06', '2027-6-30'],
        ['02/2028', '2028-2-29'],
    ])('%s -> %s', (input, expected) => {
        expect(ymd(p(input))).toBe(expected);
    });

    test('blank and junk give null; Date passes through', () => {
        expect(p('')).toBeNull();
        expect(p(null)).toBeNull();
        expect(p('junk')).toBeNull();
        const d = new Date(2027, 0, 15);
        expect(p(d)).toBe(d);
    });
});

describe('importMedicines', () => {
    test('creates medicines with opening batch from Marg-style headers', async () => {
        const { branch, user } = await makeStore();
        const s = await inventoryService.importMedicines(branch._id, user.userId, [
            { 'Item Name': 'Paracetamol 500mg', Company: 'Cipla', 'Batch No': 'PCM2401', Exp: '12/2028', Qty: '50', MRP: '30', PTR: '22', 'GST %': '12', Group: 'Analgesic' },
        ]);
        expect(s).toMatchObject({ total: 1, created: 1, batches_added: 0, failed: 0 });
        const med = await Medicine.findOne({ branch_id: branch._id, name: 'Paracetamol 500mg' });
        expect(med.manufacturer).toBe('Cipla');
        expect(med.mrp).toBe(30);
        expect(med.purchase_rate).toBe(22);
        const batch = await MedicineBatch.findOne({ medicine_id: med._id });
        expect(batch.batch_number).toBe('PCM2401');
        expect(batch.current_stock).toBe(50);
        expect(await Category.findOne({ branch_id: branch._id, name: 'Analgesic' })).not.toBeNull();
    });

    test('existing medicine (by barcode) gets a new batch instead of a duplicate', async () => {
        const { branch, user, medicine } = await makeStore();
        const s = await inventoryService.importMedicines(branch._id, user.userId, [
            { name: 'Ascoril LS Syrup', barcode: medicine.sku_barcode, batch: 'ASC-NEW-1', expiry: '06/2028', stock: 20, mrp: 120, purchase_rate: 70 },
        ]);
        expect(s.created).toBe(0);
        expect(s.batches_added).toBe(1);
        expect(await Medicine.countDocuments({ branch_id: branch._id, name: 'Ascoril LS Syrup' })).toBe(1);
        expect((await MedicineBatch.findOne({ medicine_id: medicine._id, batch_number: 'ASC-NEW-1' })).current_stock).toBe(20);
    });

    test('existing medicine by name + company, without batch details, is skipped', async () => {
        const { branch, user } = await makeStore();
        const s = await inventoryService.importMedicines(branch._id, user.userId, [{ name: 'ascoril ls syrup', manufacturer: 'GLENMARK' }]);
        expect(s.skipped).toBe(1);
        expect(s.errors[0].message).toMatch(/Already exists/);
    });

    test('row errors are reported per sheet row and do not stop the import', async () => {
        const { branch, user } = await makeStore();
        const s = await inventoryService.importMedicines(branch._id, user.userId, [
            { name: '', mrp: 10 },
            { name: 'Bad Expiry', batch: 'B1', expiry: 'soon', qty: 5, mrp: 10, ptr: 5 },
            { name: 'MRP below cost', batch: 'B2', expiry: '01/2029', qty: 5, mrp: 5, ptr: 10 },
            { name: 'Good One', batch: 'G1', expiry: '01/2029', qty: 5, mrp: 10, ptr: 5 },
        ]);
        expect(s).toMatchObject({ total: 4, created: 1, skipped: 1, failed: 2 });
        expect(s.errors.map((e) => e.row)).toEqual([2, 3, 4]);
        expect(s.errors[1].message).toMatch(/Expiry/);
    });

    test('medicine without any batch columns is created as master only', async () => {
        const { branch, user } = await makeStore();
        const s = await inventoryService.importMedicines(branch._id, user.userId, [{ name: 'Vitamin C', mrp: '₹45.00', 'gst%': '5' }]);
        expect(s.created).toBe(1);
        const med = await Medicine.findOne({ branch_id: branch._id, name: 'Vitamin C' });
        expect(med.mrp).toBe(45);
        expect(await MedicineBatch.countDocuments({ medicine_id: med._id })).toBe(0);
    });

    test('rejects empty and oversized uploads', async () => {
        const { branch, user } = await makeStore();
        await expectApiError(inventoryService.importMedicines(branch._id, user.userId, []), 'ROWS_REQUIRED', 400);
        await expectApiError(inventoryService.importMedicines(branch._id, user.userId, new Array(2001).fill({ name: 'x' })), 'TOO_MANY_ROWS', 400);
    });

    test('template CSV has the documented header and sample rows', () => {
        const lines = inventoryService.importTemplateCsv().split('\n');
        expect(lines[0].split(',')).toEqual(expect.arrayContaining(['name', 'batch_number', 'expiry_date', 'initial_stock', 'mrp', 'purchase_rate', 'gst_rate']));
        expect(lines).toHaveLength(3);
    });
});
