const request = require('supertest');
const app = require('../src/app');

describe('Pharmacist-to-Cashier Sales Workflow', () => {
  let pharmacistToken;
  let cashierToken;
  let testProductId;
  let testPaymentMethodId;
  let pendingSaleId;

  beforeAll(async () => {
    // 1. Login Pharmacist
    const pharmaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'pharmacist1', password: 'pharma123' });
    pharmacistToken = pharmaLogin.body.data.accessToken;

    // 2. Login Cashier
    const cashierLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'cashier1', password: 'cashier123' });
    cashierToken = cashierLogin.body.data.accessToken;

    // 3. Get dispensary product
    const invRes = await request(app)
      .get('/api/v1/inventory/dispensary')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    const firstItem = invRes.body.data.find((i) => i.quantity > 5);
    testProductId = firstItem.product_id;

    // 4. Get active payment method
    const pmRes = await request(app)
      .get('/api/v1/payment-methods')
      .set('Authorization', `Bearer ${cashierToken}`);
    testPaymentMethodId = pmRes.body.data[0].id;
  });

  it('Step 1: Pharmacist selects products and approves sale (creates PENDING_PAYMENT order)', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .send({
        items: [
          {
            product_id: testProductId,
            quantity: 2,
            unit_price: 15.00,
            discount: 0,
            total_price: 30.00,
          },
        ],
        discount_amount: 0,
        notes: 'Pharmacist approved prescription order',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING_PAYMENT');
    expect(res.body.data.pharmacist_id).toBeDefined();
    expect(res.body.data.cashier_id).toBeNull();

    pendingSaleId = res.body.data.id;
  });

  it('Step 2: Cashier views the pending orders queue and finds the pharmacist order', async () => {
    const res = await request(app)
      .get('/api/v1/sales?status=PENDING_PAYMENT')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const order = res.body.data.find((s) => s.id === pendingSaleId);
    expect(order).toBeDefined();
    expect(order.status).toBe('PENDING_PAYMENT');
  });

  it('Step 3: Cashier confirms payment, setting status to COMPLETED and recording cashier_id', async () => {
    const res = await request(app)
      .post(`/api/v1/sales/${pendingSaleId}/pay`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        payments: [
          {
            payment_method_id: testPaymentMethodId,
            amount: 30.00,
            reference_number: 'REF-TX-001',
          },
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.cashier_id).toBeDefined();
    expect(res.body.data.payments.length).toBe(1);
  });

  it('Step 4: Printable receipt returns both pharmacist and cashier identities', async () => {
    const res = await request(app)
      .get(`/api/v1/sales/${pendingSaleId}/receipt`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sale.pharmacist).toBeDefined();
    expect(res.body.data.sale.cashier).toBeDefined();
  });
});
