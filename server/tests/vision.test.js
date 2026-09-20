const request = require('supertest');
const app = require('../src/app');

describe('Vision & Smart Onboarding Endpoints', () => {
  let adminToken;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = loginRes.body.data.accessToken;
  });

  describe('POST /api/v1/vision/lookup-barcode', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/vision/lookup-barcode')
        .send({ barcode: '123456789012' });
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 when barcode is missing or empty', async () => {
      const res = await request(app)
        .post('/api/v1/vision/lookup-barcode')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_BARCODE');
    });

    it('should return found: false for an unknown barcode', async () => {
      const res = await request(app)
        .post('/api/v1/vision/lookup-barcode')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ barcode: '999999999999' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.found).toBe(false);
      expect(res.body.data.barcode).toBe('999999999999');
    });
  });

  describe('POST /api/v1/vision/extract-product', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/vision/extract-product');
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 when no image is uploaded', async () => {
      const res = await request(app)
        .post('/api/v1/vision/extract-product')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NO_IMAGE');
    });

    it('should return 503 when GEMINI_API_KEY is not set', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const dummyImage = Buffer.from('fake-image-data');
      const res = await request(app)
        .post('/api/v1/vision/extract-product')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', dummyImage, 'test-medicine.jpg');

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VISION_NOT_CONFIGURED');

      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });
  });
});
