const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const path = require('path');
const fs = require('fs');
const { ensureTestFixtures } = require('./testFixtures');

jest.setTimeout(30000);

describe('Improvements: WebQR Rx Upload, Batch Auto-Selection & Bulk Import', () => {
  let adminToken;
  let pharmacistToken;
  let cashierToken;
  let testProductId;

  beforeAll(async () => {
    const fixtures = await ensureTestFixtures();
    testProductId = fixtures.testProductId;

    // Admin login
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.data.accessToken;

    // Pharmacist login
    const pharmaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pharmacist1', password: 'pharma123' });
    pharmacistToken = pharmaLogin.body.data.accessToken;

    // Cashier login
    const cashierLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'cashier1', password: 'cashier123' });
    cashierToken = cashierLogin.body.data.accessToken;

    // Get an existing product
    const prodRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    testProductId = prodRes.body.data[0].id;
  });

  describe('1. WebQR Prescription Upload Workflow (No Patient Profile Required)', () => {
    let sessionId;
    let uploadedImageUrl;

    it('Step 1: Pharmacist desktop creates a QR upload session', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions/upload-session')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.uploadUrl).toContain(res.body.data.sessionId);
      sessionId = res.body.data.sessionId;
    });

    it('Step 2: Mobile device uploads prescription photo without authentication', async () => {
      // Create a small temporary dummy image
      const tempImagePath = path.join(__dirname, 'temp_test_rx.jpg');
      fs.writeFileSync(tempImagePath, Buffer.from('fake-image-binary-data'));

      const res = await request(app)
        .post(`/api/v1/prescriptions/upload-session/${sessionId}`)
        .attach('image', tempImagePath);

      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imageUrl).toBeDefined();
      uploadedImageUrl = res.body.data.imageUrl;
    });

    it('Step 3: Desktop polls upload session status and receives the image', async () => {
      const res = await request(app)
        .get(`/api/v1/prescriptions/upload-session/${sessionId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UPLOADED');
      expect(res.body.data.imageUrl).toBe(uploadedImageUrl);
    });

    it('Step 4: Pharmacist saves prescription with photo and NO patient profile', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          prescribed_by: 'Dr. Mobile Scan',
          image_url: uploadedImageUrl,
          upload_session_id: sessionId,
          items: [
            {
              product_id: testProductId,
              quantity: 2,
              dosage: '1 tab daily',
              duration: '10 days',
            },
          ],
          notes: 'Captured via WebQR without patient profile',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient_id).toBeNull();
      expect(res.body.data.image_url).toBe(uploadedImageUrl);
    });
  });

  describe('2. Smart Batch Auto-Selection for Inventory Transfers', () => {
    it('Fetches active batches for a product at a specific location', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/batches?product_id=${testProductId}&location=STORE`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.count).toBe('number');
      expect(typeof res.body.isSingleBatch).toBe('boolean');

      if (res.body.count === 1) {
        expect(res.body.isSingleBatch).toBe(true);
        expect(res.body.autoSelectedBatch).toBeDefined();
      }
    });
  });

  describe('3. Mass Product Upload and CSV Template Feature', () => {
    it('Downloads standardized CSV import template', async () => {
      const res = await request(app)
        .get('/api/v1/products/import-template')
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Name,Name_Amharic,Product_Type,Category');
      expect(res.text).toContain('MEDICINE');
      expect(res.text).toContain('COSMETIC');
    });

    it('Allows direct browser download of CSV template without auth header', async () => {
      const res = await request(app)
        .get('/api/v1/products/import-template');

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=product_import_template.csv');
      expect(res.text).toContain('MEDICINE');
    });

    it('Rejects non-admin bulk upload with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/products/bulk-upload')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ products: [{ name: 'Test Drug', unit_price: 10 }] });

      expect(res.statusCode).toBe(403);
    });

    it('Admin bulk uploads products with validation and category auto-resolution', async () => {
      // Ensure test products are cleared before creating
      const existing = await prisma.product.findMany({
        where: { name: { in: ['Azithromycin 250mg', 'Vaseline Petroleum Jelly'] } },
        select: { id: true },
      });
      if (existing.length > 0) {
        const ids = existing.map((p) => p.id);
        await prisma.inventory.deleteMany({ where: { product_id: { in: ids } } });
        await prisma.inventoryTransfer.deleteMany({ where: { product_id: { in: ids } } });
        await prisma.saleItem.deleteMany({ where: { product_id: { in: ids } } });
        await prisma.prescriptionItem.deleteMany({ where: { product_id: { in: ids } } });
        await prisma.product.deleteMany({ where: { id: { in: ids } } });
      }

      const res = await request(app)
        .post('/api/v1/products/bulk-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          products: [
            {
              name: 'Azithromycin 250mg',
              name_am: 'አዚትሮማይሲን 250mg',
              product_type: 'MEDICINE',
              category: 'Antibiotics',
              unit_price: 45.00,
              reorder_level: 20,
              dosage_form: 'Tablet',
              strength: '250mg',
              unit: 'Strip',
              requires_prescription: true,
              expiry_date: '2027-08-31',
              batch_number: 'BATCH-AZI-001',
              quantity: 100,
            },
            {
              name: 'Vaseline Petroleum Jelly',
              name_am: 'ቫዝሊን',
              product_type: 'COSMETIC',
              category: 'Skincare',
              unit_price: 95.00,
              reorder_level: 15,
              dosage_form: 'Ointment',
              strength: '100g',
              unit: 'Jar',
              requires_prescription: false,
              expiry_date: '2026-12-31',
              batch_number: 'BATCH-VAS-001',
              quantity: 50,
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.successCount).toBe(2);
      expect(res.body.data.createdCount).toBe(2);
      expect(res.body.data.duplicateCount).toBe(0);
      expect(res.body.data.failedCount).toBe(0);
    });

    it('Prevents duplicate import when uploading identical medicine with same name and batch', async () => {
      // Uploading identical medicine with same name and batch BATCH-AZI-001
      const res = await request(app)
        .post('/api/v1/products/bulk-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          products: [
            {
              name: 'Azithromycin 250mg',
              unit_price: 45.00,
              product_type: 'MEDICINE',
              dosage_form: 'Tablet',
              strength: '250mg',
              unit: 'Strip',
              requires_prescription: true,
              expiry_date: '2027-08-31',
              batch_number: 'BATCH-AZI-001',
              quantity: 50,
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.duplicateCount).toBe(1);
      expect(res.body.data.duplicates.length).toBe(1);
      expect(res.body.data.duplicates[0].name).toBe('Azithromycin 250mg');
      expect(res.body.data.duplicates[0].reason).toContain('already exists in inventory');

      // Verify no duplicate product was created in DB
      const count = await prisma.product.count({
        where: { name: 'Azithromycin 250mg' },
      });
      expect(count).toBe(1);
    });

    it('Adds new batch to existing medicine without duplicating the product', async () => {
      // Same medicine name, but DIFFERENT batch BATCH-AZI-002
      const res = await request(app)
        .post('/api/v1/products/bulk-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          products: [
            {
              name: 'Azithromycin 250mg',
              unit_price: 45.00,
              product_type: 'MEDICINE',
              dosage_form: 'Tablet',
              strength: '250mg',
              unit: 'Strip',
              requires_prescription: true,
              expiry_date: '2028-03-31',
              batch_number: 'BATCH-AZI-002',
              quantity: 75,
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedCount).toBe(1);
      expect(res.body.data.createdCount).toBe(0);
      expect(res.body.data.duplicateCount).toBe(0);

      // Verify product count in DB remains 1
      const productCount = await prisma.product.count({
        where: { name: 'Azithromycin 250mg' },
      });
      expect(productCount).toBe(1);

      // Verify inventory has both batches
      const batches = await prisma.inventory.findMany({
        where: { product: { name: 'Azithromycin 250mg' } },
      });
      expect(batches.length).toBe(2);
    });

    it('Admin can trigger duplicate cleanup endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/products/cleanup-duplicates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('cleanedGroupsCount');
      expect(res.body.data).toHaveProperty('removedDuplicatesCount');
    });

    it('Admin bulk receives multiple inventory items into store', async () => {
      const prod = await prisma.product.findFirst({ where: { is_active: true } });
      testProductId = prod.id;

      const res = await request(app)
        .post('/api/v1/inventory/bulk-receive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            {
              product_id: testProductId,
              batch_number: 'BULK-TEST-001',
              quantity: 50,
              shelf_location: 'Bay A',
              supplier_name: 'Test Pharma Supplier',
            },
            {
              product_id: testProductId,
              batch_number: 'BULK-TEST-002',
              quantity: 25,
              shelf_location: 'Bay B',
              supplier_name: 'Test Pharma Supplier',
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
    });

    it('Creates medicine or cosmetic with expiration date and batch number', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ciprofloxacin 500mg',
          product_type: 'MEDICINE',
          unit_price: 32.50,
          reorder_level: 15,
          dosage_form: 'Tablet',
          strength: '500mg',
          unit: 'Strip',
          requires_prescription: true,
          expiry_date: '2027-12-31',
          batch_number: 'CIPRO-2025-01',
          initial_quantity: 40,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inventory).toBeDefined();
      expect(res.body.data.inventory.length).toBeGreaterThan(0);
      expect(res.body.data.inventory[0].batch_number).toBe('CIPRO-2025-01');
      expect(res.body.data.inventory[0].expiry_date).toContain('2027-12-31');
    });

    it('Edits and changes expiration date on existing product', async () => {
      // First create a product
      const createRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Glycerin Skin Lotion',
          product_type: 'COSMETIC',
          unit_price: 150.00,
          dosage_form: 'Lotion',
          strength: '200ml',
          unit: 'Bottle',
          requires_prescription: false,
          expiry_date: '2026-06-30',
          batch_number: 'GLY-01',
          initial_quantity: 20,
        });

      expect(createRes.statusCode).toBe(201);
      const prodId = createRes.body.data.id;

      // Update the expiration date to 2028-09-30
      const updateRes = await request(app)
        .put(`/api/v1/products/${prodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expiry_date: '2028-09-30',
          batch_number: 'GLY-01-REVISED',
        });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.success).toBe(true);

      const verifyRes = await request(app)
        .get(`/api/v1/products/${prodId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.body.data.inventory[0].expiry_date).toContain('2028-09-30');
      expect(verifyRes.body.data.inventory[0].batch_number).toBe('GLY-01-REVISED');
    });

    it('Rejects product creation if any of the 10 required fields is missing', async () => {
      // Incomplete payload missing unit, dosage_form, and strength
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Medicine',
          product_type: 'MEDICINE',
          unit_price: 50.0,
          requires_prescription: true,
          expiry_date: '2027-12-31',
          batch_number: 'INC-001',
          initial_quantity: 10,
          // Missing unit, dosage_form, strength
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_REQUIRED_FIELDS');
      expect(res.body.error.missingFields).toContain('Unit (bottle, strip, sachet, ampule, etc.)');
      expect(res.body.error.missingFields).toContain('Dosage Form');
      expect(res.body.error.missingFields).toContain('Strength (e.g., 100mg, 50g)');
    });

    it('Auto-generates standard Barcode and SKU when omitted during product creation', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Auto Barcode Ampicillin',
          product_type: 'MEDICINE',
          unit_price: 30.00,
          requires_prescription: true,
          expiry_date: '2028-06-30',
          batch_number: 'AMP-AUTO-01',
          initial_quantity: 25,
          unit: 'Vial',
          dosage_form: 'Injection',
          strength: '500mg',
          // barcode and sku omitted
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.barcode).toBeDefined();
      expect(res.body.data.barcode).toMatch(/^890/);
      expect(res.body.data.sku).toBeDefined();
      expect(res.body.data.sku).toMatch(/^MED-AUT-/);
      expect(res.body.data.unit).toBe('Vial');
    });

    it('Rejects bulk import row if required fields are missing and reports exact missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/products/bulk-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          products: [
            {
              name: 'Incomplete Bulk Medicine',
              product_type: 'MEDICINE',
              unit_price: 20.0,
              // missing requires_prescription, expiry_date, batch_number, quantity, unit, dosage_form, strength
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.failedCount).toBe(1);
      expect(res.body.data.successCount).toBe(0);
      expect(res.body.data.errors.length).toBe(1);
      expect(res.body.data.errors[0].missingFields).toContain('Expiry Date');
      expect(res.body.data.errors[0].missingFields).toContain('Batch Number');
      expect(res.body.data.errors[0].missingFields).toContain('Quantity');
      expect(res.body.data.errors[0].missingFields).toContain('Unit (bottle, strip, sachet, ampule, etc.)');
    });

    it('Updates expiration date directly on inventory record via /api/v1/inventory/:id', async () => {
      const invListRes = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      const item = invListRes.body.data[0];
      expect(item).toBeDefined();

      const adjustRes = await request(app)
        .put(`/api/v1/inventory/${item.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          expiry_date: '2029-05-15',
          reason: 'Corrected factory expiry date',
        });

      expect(adjustRes.statusCode).toBe(200);
      expect(adjustRes.body.success).toBe(true);
      expect(adjustRes.body.data.expiry_date).toContain('2029-05-15');
    });
  });

  describe('5. System Notifications API', () => {
    it('Requires authentication for /api/v1/notifications', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.statusCode).toBe(401);
    });

    it('Returns structured notifications and category counts for logged-in user', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toBeInstanceOf(Array);
      expect(res.body.data.counts).toBeDefined();
      expect(typeof res.body.data.counts.total).toBe('number');
      expect(typeof res.body.data.counts.inventory).toBe('number');
      expect(typeof res.body.data.counts.orders).toBe('number');
    });
  });

  describe('6. Shift Tracking & Isolated Cashier Reconciliations', () => {
    let activeShiftId;
    let shiftReconciliationId;

    it('Cashier can start a new shift with opening cash drawer float', async () => {
      // Ensure clean state: end any existing active shift
      await request(app)
        .post('/api/v1/shifts/end')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ notes: 'Cleanup for test' });

      const res = await request(app)
        .post('/api/v1/shifts/start')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          shift_name: 'Morning Cashier Shift',
          opening_balance: 500,
        });

      expect([200, 201]).toContain(res.statusCode);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shift_name).toBeDefined();
      expect(Number(res.body.data.opening_balance)).toBe(500);
      expect(res.body.data.status).toBe('ACTIVE');
      activeShiftId = res.body.data.id;
    });

    it('Cashier can fetch their active shift and live drawer metrics', async () => {
      const res = await request(app)
        .get('/api/v1/shifts/current')
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shift).toBeDefined();
      expect(res.body.data.shift.id).toBe(activeShiftId);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.metrics.opening_cash).toBe(500);
    });

    it('Cashier previews reconciliation strictly scoped to their shift', async () => {
      const res = await request(app)
        .get(`/api/v1/reconciliation/preview?type=SHIFT&shift_id=${activeShiftId}`)
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reconciliation_type).toBe('SHIFT');
      expect(Number(res.body.data.shift.opening_balance)).toBe(500);
      expect(res.body.data.methods).toBeInstanceOf(Array);
    });

    it('Cashier can submit shift reconciliation and close out their shift drawer', async () => {
      const preview = await request(app)
        .get(`/api/v1/reconciliation/preview?type=SHIFT&shift_id=${activeShiftId}`)
        .set('Authorization', `Bearer ${cashierToken}`);

      const entries = preview.body.data.methods.map((b) => ({
        payment_method_id: b.payment_method_id,
        expected_amount: b.expected_amount,
        actual_amount: b.expected_amount,
        reference_numbers: b.reference_numbers || [],
      }));

      const res = await request(app)
        .post('/api/v1/reconciliation')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          date: new Date().toISOString().slice(0, 10),
          reconciliation_type: 'SHIFT',
          shift_id: activeShiftId,
          entries,
          notes: 'Shift drawer balanced and verified',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.reconciliation_type).toBe('SHIFT');
      shiftReconciliationId = res.body.data.id;
    });

    it('Super Admin (Owner) can view shift summary across staff members', async () => {
      const res = await request(app)
        .get('/api/v1/shifts/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cashier_shifts).toBeInstanceOf(Array);
      expect(res.body.data.pharmacist_summary).toBeInstanceOf(Array);
    });

    it('Super Admin (Owner) can preview daily master reconciliation', async () => {
      const res = await request(app)
        .get('/api/v1/reconciliation/preview?type=DAILY')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reconciliation_type).toBe('DAILY');
      expect(res.body.data.daily_shifts).toBeInstanceOf(Array);
    });

    it('Non-admin cannot approve master reconciliation (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/reconciliation/${shiftReconciliationId}/approve`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ action: 'APPROVED' });

      expect(res.statusCode).toBe(403);
    });

    it('Super Admin (Owner) can approve reconciliation', async () => {
      const res = await request(app)
        .post(`/api/v1/reconciliation/${shiftReconciliationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVED', notes: 'Drawer verified by Owner' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('Super Admin can inspect complete details of a cashier shift submission', async () => {
      const res = await request(app)
        .get(`/api/v1/shifts/${activeShiftId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shift).toBeDefined();
      expect(res.body.data.shift.id).toBe(activeShiftId);
      expect(res.body.data.sales).toBeInstanceOf(Array);
      expect(res.body.data.payment_methods).toBeInstanceOf(Array);
    });

    it('Super Admin can inspect detailed pharmacist clinical activity and prescriptions', async () => {
      const summaryRes = await request(app)
        .get('/api/v1/shifts/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      const pharmacistId = summaryRes.body.data.pharmacist_summary[0]?.pharmacist?.id;

      if (pharmacistId) {
        const res = await request(app)
          .get(`/api/v1/shifts/pharmacist-activity?pharmacist_id=${pharmacistId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.pharmacist).toBeDefined();
        expect(res.body.data.summary).toBeDefined();
        expect(res.body.data.approved_sales).toBeInstanceOf(Array);
        expect(res.body.data.dispensed_prescriptions).toBeInstanceOf(Array);
      }
    });
  });
});
