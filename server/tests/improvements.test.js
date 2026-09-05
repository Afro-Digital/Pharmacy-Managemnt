const request = require('supertest');
const app = require('../src/app');
const path = require('path');
const fs = require('fs');

describe('Improvements: WebQR Rx Upload, Batch Auto-Selection & Bulk Import', () => {
  let adminToken;
  let pharmacistToken;
  let testProductId;

  beforeAll(async () => {
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
            },
            {
              name: 'Vaseline Petroleum Jelly',
              name_am: 'ቫዝሊን',
              product_type: 'COSMETIC',
              category: 'Skincare',
              unit_price: 95.00,
              reorder_level: 15,
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.successCount).toBe(2);
      expect(res.body.data.failedCount).toBe(0);
    });

    it('Admin bulk receives multiple inventory items into store', async () => {
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
          expiry_date: '2026-06-30',
          batch_number: 'GLY-01',
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
});
