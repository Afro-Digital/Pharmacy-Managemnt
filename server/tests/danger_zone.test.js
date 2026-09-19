const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

jest.setTimeout(30000);

describe('Admin Danger Zone Feature', () => {
  let adminToken;
  let pharmacistToken;
  let cashierToken;

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

    // Cashier login
    const cashierLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'cashier1', password: 'cashier123' });
    cashierToken = cashierLogin.body.data.accessToken;
  });

  describe('Security & Access Controls', () => {
    it('Blocks unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/danger-zone/stats');
      expect(res.statusCode).toBe(401);
    });

    it('Blocks Cashier role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/danger-zone/stats')
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(res.statusCode).toBe(403);
    });

    it('Blocks Pharmacist role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/danger-zone/delete-all-products')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ password: 'pharma123', confirmPhrase: 'DELETE ALL PRODUCTS' });
      expect(res.statusCode).toBe(403);
    });

    it('Allows Admin to view stats', async () => {
      const res = await request(app)
        .get('/api/v1/danger-zone/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('productsCount');
      expect(res.body.data).toHaveProperty('inventoryCount');
      expect(res.body.data).toHaveProperty('salesCount');
    });

    it('Rejects request if confirmation phrase does not match', async () => {
      const res = await request(app)
        .post('/api/v1/danger-zone/delete-all-products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'admin123', confirmPhrase: 'WRONG PHRASE' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('CONFIRMATION_MISMATCH');
    });

    it('Rejects request if admin password is incorrect', async () => {
      const res = await request(app)
        .post('/api/v1/danger-zone/delete-all-products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'wrongPassword!#', confirmPhrase: 'DELETE ALL PRODUCTS' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });
  });

  describe('Destructive Danger Zone Operations', () => {
    it('Resets all inventory stock levels to zero', async () => {
      // First ensure there is at least one product with inventory
      let testProd = await prisma.product.findFirst({
        include: { inventory: true },
      });
      if (!testProd) {
        testProd = await prisma.product.create({
          data: {
            name: 'Danger Zone Test Product',
            product_type: 'MEDICINE',
            unit_price: 25.0,
            inventory: {
              create: { location: 'STORE', quantity: 150, batch_number: 'DZ-TEST-001' },
            },
          },
        });
      }

      const res = await request(app)
        .post('/api/v1/danger-zone/reset-inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'admin123', confirmPhrase: 'RESET STOCK TO ZERO' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all inventory quantities are zero
      const positiveBatches = await prisma.inventory.count({
        where: { quantity: { gt: 0 } },
      });
      expect(positiveBatches).toBe(0);
    });

    it('Deletes all products and inventory', async () => {
      // Create a test product
      await prisma.product.create({
        data: {
          name: 'DZ Product To Delete',
          product_type: 'MEDICINE',
          unit_price: 15.0,
          inventory: {
            create: { location: 'STORE', quantity: 20, batch_number: 'DZ-DEL-01' },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/danger-zone/delete-all-products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'admin123', confirmPhrase: 'DELETE ALL PRODUCTS' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify products table is empty
      const totalProducts = await prisma.product.count();
      expect(totalProducts).toBe(0);

      // Verify inventory table is empty
      const totalInventory = await prisma.inventory.count();
      expect(totalInventory).toBe(0);
    });

    it('Re-creates essential catalog item and tests clear-all-sales', async () => {
      const res = await request(app)
        .post('/api/v1/danger-zone/clear-all-sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'admin123', confirmPhrase: 'CLEAR ALL SALES' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const totalSales = await prisma.sale.count();
      expect(totalSales).toBe(0);
    });
  });

  afterAll(async () => {
    // Restore sample products & inventory for other test suites
    const { execSync } = require('child_process');
    const path = require('path');
    execSync('node prisma/seed.js', { cwd: path.join(__dirname, '..') });
  });
});
