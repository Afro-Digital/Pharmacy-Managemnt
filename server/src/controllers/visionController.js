const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const prisma = require('../config/database');

// Reuse normalizeExpiryDateString from productController scope — inlined here to avoid circular deps
const normalizeExpiryDateString = (rawInput) => {
  if (!rawInput && rawInput !== 0) return null;
  const str = String(rawInput).trim();
  if (!str) return null;

  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 30000 && num <= 70000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    let day = p1, month = p2;
    if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
    else if (p2 > 12 && p1 <= 12) { month = p1; day = p2; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const myMatch = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (myMatch) {
    const m = parseInt(myMatch[1], 10);
    const y = parseInt(myMatch[2], 10);
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }
  const ymMatch = str.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1990 && y <= 2100) {
      return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  return null;
};

// The structured prompt sent to Gemini Vision
const EXTRACTION_PROMPT = `You are a pharmaceutical inventory assistant for an Ethiopian pharmacy management system.

Analyze this medicine packaging photo carefully and extract as many of the following fields as possible.

Return ONLY a valid JSON object with exactly these keys:
{
  "name": "Full product name as printed on the packaging",
  "name_am": "Amharic name if visible on the packaging, otherwise null",
  "product_type": "MEDICINE or COSMETIC",
  "generic_name": "Generic/INN name if visible (e.g. Amoxicillin, Paracetamol), otherwise null",
  "dosage_form": "Tablet, Capsule, Syrup, Suspension, Injection, Cream, Ointment, Drops, Inhaler, Gel, Powder, or other form visible",
  "strength": "Strength with unit as printed (e.g. 500mg, 250mg/5ml, 100ml), otherwise null",
  "brand": "Brand name if visible and different from generic name, otherwise null",
  "manufacturer": "Manufacturer/company name if visible, otherwise null",
  "batch_number": "Batch number or Lot number if visible (often prefixed with B.N., Batch No., Lot), otherwise null",
  "expiry_date": "Expiry date exactly as printed on packaging (e.g. 08/2027, 2027-08-31, EXP 08/27), otherwise null",
  "barcode": "Barcode number if any digits are readable near a barcode, otherwise null",
  "requires_prescription": true if you see Rx, ℞, or prescription-only markings; false if OTC or no marking visible,
  "unit": "Packaging unit: Strip, Bottle, Box, Tube, Vial, Sachet, Ampule — infer from the packaging type",
  "category": "Pharmaceutical category if determinable (e.g. Antibiotic, Analgesic, Antacid, Vitamin), otherwise null",
  "description": "Brief description of the medicine based on what you can see, otherwise null",
  "confidence": 0.0 to 1.0 overall confidence in your extraction
}

Important rules:
- Return ONLY the JSON object, no markdown, no explanation, no code fences.
- Use null for any field you cannot determine from the image.
- For expiry_date, transcribe it exactly as printed — the system will normalize it.
- Be conservative with confidence: use 0.9+ only if the image is very clear.
- If the image is blurry, dark, or not a medicine package, set confidence to 0.0 and set all fields to null.`;

// In-memory store for phone scan sessions
const scanSessions = new Map();

// Periodic cleanup of sessions older than 30 mins
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, s] of scanSessions.entries()) {
    if (s.createdAt < cutoff) scanSessions.delete(id);
  }
}, 15 * 60 * 1000).unref();

// Shared helper to process image buffer with Gemini Vision and DB lookup
const processMedicineImageBuffer = async (buffer, apiKey) => {
  // Preprocess image: resize to max 1024px width, convert to JPEG, compress
  let imageBuffer;
  try {
    imageBuffer = await sharp(buffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (imgErr) {
    const err = new Error('Could not process the uploaded image. Please try a different photo.');
    err.code = 'INVALID_IMAGE';
    err.statusCode = 400;
    throw err;
  }

  // Call Gemini Vision API
  const genAI = new GoogleGenerativeAI(apiKey);
  const primaryModelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: 'image/jpeg',
    },
  };

  let result;
  try {
    const model = genAI.getGenerativeModel({ model: primaryModelName });
    result = await model.generateContent([EXTRACTION_PROMPT, imagePart]);
  } catch (modelErr) {
    // If the model is not found or deprecated, try alternative versions
    if (
      modelErr.message &&
      (modelErr.message.includes('404') ||
        modelErr.message.includes('not available') ||
        modelErr.message.includes('no longer available'))
    ) {
      console.warn(`Model ${primaryModelName} not available, attempting fallback:`, modelErr.message);
      try {
        const fallback1 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        result = await fallback1.generateContent([EXTRACTION_PROMPT, imagePart]);
      } catch (err2) {
        const fallback2 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        result = await fallback2.generateContent([EXTRACTION_PROMPT, imagePart]);
      }
    } else {
      throw modelErr;
    }
  }
  const responseText = result.response.text();

  // Parse JSON from the response (handle potential markdown code fences)
  let extracted;
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    extracted = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('Gemini response parse error:', responseText);
    const err = new Error('Could not extract product information from the image. Please try a clearer photo.');
    err.code = 'EXTRACTION_FAILED';
    err.statusCode = 422;
    err.raw = responseText.substring(0, 500);
    throw err;
  }

  // Post-process: normalize the expiry date
  if (extracted.expiry_date) {
    const normalized = normalizeExpiryDateString(extracted.expiry_date);
    extracted.expiry_date_raw = extracted.expiry_date;
    extracted.expiry_date = normalized || extracted.expiry_date;
  }

  // Post-process: normalize product_type
  if (extracted.product_type) {
    extracted.product_type = extracted.product_type.toUpperCase().trim();
    if (extracted.product_type !== 'MEDICINE' && extracted.product_type !== 'COSMETIC') {
      extracted.product_type = 'MEDICINE';
    }
  } else {
    extracted.product_type = 'MEDICINE';
  }

  // If barcode was extracted, check for existing product in DB
  let existingProduct = null;
  if (extracted.barcode) {
    existingProduct = await prisma.product.findFirst({
      where: { barcode: extracted.barcode },
      include: {
        category: true,
        inventory: {
          select: {
            id: true, location: true, batch_number: true, expiry_date: true, quantity: true,
          },
          orderBy: { expiry_date: 'asc' },
        },
      },
    });
  }

  // If name was extracted but no barcode match, try name match
  if (!existingProduct && extracted.name) {
    existingProduct = await prisma.product.findFirst({
      where: {
        name: { equals: extracted.name, mode: 'insensitive' },
      },
      include: {
        category: true,
        inventory: {
          select: {
            id: true, location: true, batch_number: true, expiry_date: true, quantity: true,
          },
          orderBy: { expiry_date: 'asc' },
        },
      },
    });
  }

  // Try to match category from DB
  let matchedCategoryId = null;
  if (extracted.category) {
    const cat = await prisma.category.findFirst({
      where: {
        name: { contains: extracted.category, mode: 'insensitive' },
        type: extracted.product_type,
      },
    });
    if (cat) matchedCategoryId = cat.id;
  }

  return {
    data: {
      extracted,
      existingProduct: existingProduct
        ? {
            id: existingProduct.id,
            name: existingProduct.name,
            barcode: existingProduct.barcode,
            sku: existingProduct.sku,
            totalStock: existingProduct.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
            batchCount: existingProduct.inventory.length,
          }
        : null,
      matchedCategoryId,
      isNewProduct: !existingProduct,
    },
    message: existingProduct
      ? `Found existing product: "${existingProduct.name}". You can add a new batch to it.`
      : 'New product detected. Review the extracted data and confirm to add it.',
  };
};

// POST /api/v1/vision/extract-product
const extractProductFromImage = async (req, res, next) => {
  try {
    // Check for uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_IMAGE',
          message: 'Please upload an image of the medicine packaging.',
        },
      });
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'VISION_NOT_CONFIGURED',
          message: 'Smart scan is not configured. Please add GEMINI_API_KEY to your server environment.',
        },
      });
    }

    try {
      const result = await processMedicineImageBuffer(req.file.buffer, apiKey);
      res.json({
        success: true,
        ...result,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'EXTRACTION_FAILED',
            message: err.message,
            raw: err.raw,
          },
        });
      }
      throw err;
    }
  } catch (err) {
    // Handle Gemini API errors gracefully
    if (err.message && (err.message.includes('API_KEY') || err.message.includes('403'))) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'VISION_API_ERROR',
          message: 'The vision API key is invalid or has reached its rate limit. Please try again later.',
        },
      });
    }
    next(err);
  }
};

// POST /api/v1/vision/scan-session
const createScanSession = async (req, res, next) => {
  try {
    const sessionId = `medscan-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    scanSessions.set(sessionId, {
      status: 'PENDING',
      data: null,
      message: null,
      error: null,
      createdAt: Date.now(),
    });

    res.json({
      success: true,
      data: {
        sessionId,
        uploadUrl: `/medicine-scan/${sessionId}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/vision/scan-session/:sessionId
const getScanSessionStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = scanSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scan session not found or expired' },
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/vision/scan-session/:sessionId
const uploadScanSessionImage = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = scanSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scan session not found or expired' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_IMAGE', message: 'Please upload an image of the medicine packaging.' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      session.status = 'FAILED';
      session.error = 'Smart scan is not configured. Please add GEMINI_API_KEY to server environment.';
      return res.status(503).json({
        success: false,
        error: { code: 'VISION_NOT_CONFIGURED', message: session.error },
      });
    }

    session.status = 'ANALYZING';

    try {
      const result = await processMedicineImageBuffer(req.file.buffer, apiKey);
      session.status = 'COMPLETED';
      session.data = result.data;
      session.message = result.message;

      res.json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (err) {
      session.status = 'FAILED';
      session.error = err.message || 'Could not extract product information.';
      res.status(err.statusCode || 422).json({
        success: false,
        error: {
          code: err.code || 'EXTRACTION_FAILED',
          message: session.error,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/vision/lookup-barcode
const lookupBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.body;

    if (!barcode || !barcode.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_BARCODE', message: 'Barcode value is required.' },
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { barcode: barcode.trim() },
          { sku: barcode.trim() },
        ],
      },
      include: {
        category: true,
        inventory: {
          select: {
            id: true, location: true, batch_number: true, expiry_date: true, quantity: true,
          },
          orderBy: { expiry_date: 'asc' },
        },
      },
    });

    if (!product) {
      return res.json({
        success: true,
        data: { found: false, barcode: barcode.trim() },
        message: `No product found with barcode "${barcode.trim()}". You can create a new product.`,
      });
    }

    res.json({
      success: true,
      data: {
        found: true,
        product: {
          id: product.id,
          name: product.name,
          name_am: product.name_am,
          product_type: product.product_type,
          generic_name: product.generic_name,
          dosage_form: product.dosage_form,
          strength: product.strength,
          brand: product.brand,
          manufacturer: product.manufacturer,
          unit_price: product.unit_price,
          unit: product.unit,
          barcode: product.barcode,
          sku: product.sku,
          requires_prescription: product.requires_prescription,
          category: product.category,
          totalStock: product.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
          batches: product.inventory,
        },
      },
      message: `Found product: "${product.name}".`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  extractProductFromImage,
  lookupBarcode,
  createScanSession,
  getScanSessionStatus,
  uploadScanSessionImage,
};
