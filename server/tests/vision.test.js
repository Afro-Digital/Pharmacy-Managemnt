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

  describe('Phone Scan Session Endpoints', () => {
    let createdSessionId;

    it('should create a new phone scan session', async () => {
      const res = await request(app)
        .post('/api/v1/vision/scan-session')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.uploadUrl).toContain('/medicine-scan/');
      createdSessionId = res.data?.sessionId || res.body.data.sessionId;
    });

    it('should fetch the status of an existing scan session', async () => {
      const res = await request(app)
        .get(`/api/v1/vision/scan-session/${createdSessionId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(['WAITING_FOR_PHONE', 'PENDING']).toContain(res.body.data.status);
    });

    it('should connect phone to scan session', async () => {
      const res = await request(app)
        .post(`/api/v1/vision/scan-session/${createdSessionId}/connect`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phoneConnected).toBe(true);
    });

    it('should submit stage 1 barcode asynchronously', async () => {
      const res = await request(app)
        .post(`/api/v1/vision/scan-session/${createdSessionId}/stage1-barcode`)
        .send({ barcode: '8901234567890' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.barcode).toBe('8901234567890');
    });

    it('should return 404 for a nonexistent scan session', async () => {
      const res = await request(app)
        .get('/api/v1/vision/scan-session/nonexistent-session-12345');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
