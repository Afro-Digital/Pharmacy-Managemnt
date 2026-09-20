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

const STAGE_2_EXPIRY_PROMPT = `You are a pharmaceutical inspection assistant. Analyze this photo of a medicine packaging (carton flap, blister foil, bottle label, or stamp).
Extract the batch/lot number and expiration date:
{
  "batch_number": "Batch or Lot number if visible (e.g. B123, LOT9876), or null",
  "expiry_date": "Expiration date exactly as printed (e.g. 08/2027, 2027-08-31, 31/08/27, AUG 27), or null",
  "name": "Product name if clearly legible, or null",
  "strength": "Dosage strength if visible (e.g. 500mg, 100ml), or null",
  "confidence": 0.0-1.0 confidence score
}
Return ONLY valid JSON. Use null for missing values.`;

// In-memory task queues per session for asynchronous non-blocking processing
const sessionQueues = new Map();

const queueSessionTask = (sessionId, taskFn) => {
  const current = sessionQueues.get(sessionId) || Promise.resolve();
  const next = current
    .then(taskFn)
    .catch((err) => {
      console.error(`Error executing session ${sessionId} queue task:`, err);
    });
  sessionQueues.set(sessionId, next);
  return next;
};

// POST /api/v1/vision/scan-session
const createScanSession = async (req, res, next) => {
  try {
    const sessionId = `medscan-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const session = {
      id: sessionId,
      status: 'WAITING_FOR_PHONE', // WAITING_FOR_PHONE | CONNECTED | PROCESSING | COMPLETED | FAILED
      phoneConnected: false,
      phoneConnectedAt: null,
      stage1: {
        status: 'IDLE', // IDLE | PROCESSING | COMPLETED | FAILED
        barcode: null,
        productFound: false,
        message: null,
        error: null,
      },
      stage2: {
        status: 'IDLE', // IDLE | QUEUED | PROCESSING | COMPLETED | FAILED
        batch_number: null,
        expiry_date: null,
        message: null,
        error: null,
      },
      productData: {
        name: '',
        name_am: '',
        product_type: 'MEDICINE',
        generic_name: '',
        dosage_form: '',
        strength: '',
        brand: '',
        manufacturer: '',
        unit_price: '',
        reorder_level: 10,
        unit: 'strip',
        barcode: '',
        sku: '',
        batch_number: '',
        expiry_date: '',
        initial_quantity: '',
        initial_location: 'STORE',
        requires_prescription: false,
        category_id: '',
        description: '',
      },
      fieldSources: {},
      existingProduct: null,
      isNewProduct: true,
      message: 'Waiting for smartphone to scan QR code...',
      error: null,
      createdAt: Date.now(),
    };

    scanSessions.set(sessionId, session);

    res.json({
      success: true,
      data: {
        sessionId,
        uploadUrl: `/medicine-scan/${sessionId}`,
        session,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/vision/scan-session/:sessionId/connect
const connectScanSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = scanSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scan session not found or expired' },
      });
    }

    session.phoneConnected = true;
    session.phoneConnectedAt = Date.now();
    if (session.status === 'WAITING_FOR_PHONE') {
      session.status = 'CONNECTED';
      session.message = 'Phone connected! Ready for Stage 1: Barcode Scan.';
    }

    res.json({
      success: true,
      data: session,
      message: 'Phone connected successfully',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/vision/scan-session/:sessionId/stage1-barcode
const submitStage1Barcode = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = scanSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scan session not found or expired' },
      });
    }

    const { barcode } = req.body || {};
    if (!barcode && !req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_BARCODE', message: 'Barcode string or image is required' },
      });
    }

    session.stage1.status = 'PROCESSING';
    session.status = 'PROCESSING';
    session.message = 'Processing Stage 1: Reading barcode & product identity...';

    const fileBuffer = req.file ? req.file.buffer : null;
    const barcodeInput = barcode ? String(barcode).trim() : null;

    // Asynchronously process Stage 1 in the session queue
    queueSessionTask(sessionId, async () => {
      try {
        let code = barcodeInput;

        // If an image was submitted instead of a raw barcode string, use Gemini vision
        if (!code && fileBuffer) {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            try {
              const res = await processMedicineImageBuffer(fileBuffer, apiKey);
              if (res.data?.extracted?.barcode) {
                code = res.data.extracted.barcode;
              }
              if (res.data?.extracted) {
                const ext = res.data.extracted;
                Object.assign(session.productData, {
                  name: ext.name || session.productData.name,
                  name_am: ext.name_am || session.productData.name_am,
                  product_type: ext.product_type || session.productData.product_type,
                  generic_name: ext.generic_name || session.productData.generic_name,
                  dosage_form: ext.dosage_form || session.productData.dosage_form,
                  strength: ext.strength || session.productData.strength,
                  brand: ext.brand || session.productData.brand,
                  manufacturer: ext.manufacturer || session.productData.manufacturer,
                  unit: ext.unit || session.productData.unit,
                  category_id: res.data.matchedCategoryId || session.productData.category_id,
                });
                session.fieldSources.name = 'STAGE_1_VISION';
              }
            } catch (vErr) {
              console.warn('Vision extraction for stage 1 image failed:', vErr.message);
            }
          }
        }

        if (code) {
          session.stage1.barcode = code;
          session.productData.barcode = code;
          session.fieldSources.barcode = 'STAGE_1_BARCODE';

          // Check database for existing product match
          const existing = await prisma.product.findFirst({
            where: {
              OR: [{ barcode: code }, { sku: code }],
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

          if (existing) {
            session.existingProduct = {
              id: existing.id,
              name: existing.name,
              barcode: existing.barcode,
              sku: existing.sku,
              totalStock: existing.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
              batchCount: existing.inventory.length,
            };
            session.isNewProduct = false;
            session.stage1.productFound = true;
            session.stage1.message = `Found existing product: "${existing.name}".`;

            // Merge existing product info
            Object.assign(session.productData, {
              name: existing.name,
              name_am: existing.name_am || '',
              product_type: existing.product_type,
              generic_name: existing.generic_name || '',
              dosage_form: existing.dosage_form || '',
              strength: existing.strength || '',
              brand: existing.brand || '',
              manufacturer: existing.manufacturer || '',
              unit_price: existing.unit_price,
              unit: existing.unit || 'strip',
              category_id: existing.category_id || '',
              requires_prescription: existing.requires_prescription,
            });
            session.fieldSources.name = 'EXISTING_DB';
            session.fieldSources.dosage_form = 'EXISTING_DB';
            session.fieldSources.strength = 'EXISTING_DB';
            session.fieldSources.unit_price = 'EXISTING_DB';
          } else {
            session.isNewProduct = true;
            session.stage1.productFound = false;
            session.stage1.message = `Barcode "${code}" detected (New product).`;
          }
        }

        session.stage1.status = 'COMPLETED';
        if (session.stage2.status !== 'PROCESSING' && session.stage2.status !== 'QUEUED') {
          session.message = 'Stage 1 Complete: Barcode detected. Ready for Stage 2: Expiry & Batch.';
        }
      } catch (err) {
        console.error('Stage 1 processing error:', err);
        session.stage1.status = 'FAILED';
        session.stage1.error = err.message;
      }
    });

    // Non-blocking response to the phone
    res.json({
      success: true,
      message: 'Barcode accepted and processing asynchronously',
      data: {
        stage1Status: session.stage1.status,
        barcode: barcodeInput,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/vision/scan-session/:sessionId/stage2-expiry
const submitStage2Expiry = async (req, res, next) => {
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
        error: { code: 'NO_IMAGE', message: 'Please upload an image of the expiry date and batch number.' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      session.stage2.status = 'FAILED';
      session.stage2.error = 'Smart scan is not configured. Please add GEMINI_API_KEY to server environment.';
      return res.status(503).json({
        success: false,
        error: { code: 'VISION_NOT_CONFIGURED', message: session.stage2.error },
      });
    }

    // If Stage 1 is still processing, mark Stage 2 as QUEUED
    const isQueued = session.stage1.status === 'PROCESSING';
    session.stage2.status = isQueued ? 'QUEUED' : 'PROCESSING';
    session.message = isQueued
      ? 'Stage 2 Photo Queued: Waiting for Stage 1 to finish...'
      : 'Stage 2 Photo Received: Analyzing expiry date & batch number...';

    const fileBuffer = req.file.buffer;

    // Enqueue Stage 2 in sequence behind Stage 1
    queueSessionTask(sessionId, async () => {
      session.stage2.status = 'PROCESSING';
      session.message = 'Processing Stage 2: Extracting expiry date & batch number with AI...';

      try {
        let imageBuffer;
        try {
          imageBuffer = await sharp(fileBuffer)
            .resize({ width: 1024, withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        } catch (imgErr) {
          session.stage2.status = 'FAILED';
          session.stage2.error = 'Could not process uploaded image.';
          return;
        }

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
          result = await model.generateContent([STAGE_2_EXPIRY_PROMPT, imagePart]);
        } catch (modelErr) {
          console.warn(`Model ${primaryModelName} fallback in stage 2:`, modelErr.message);
          try {
            const fallback1 = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            result = await fallback1.generateContent([STAGE_2_EXPIRY_PROMPT, imagePart]);
          } catch (e2) {
            const fallback2 = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            result = await fallback2.generateContent([STAGE_2_EXPIRY_PROMPT, imagePart]);
          }
        }

        const responseText = result.response.text();
        let extracted = {};
        try {
          let jsonStr = responseText.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }
          extracted = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.error('Stage 2 JSON parse error:', responseText);
        }

        if (extracted.expiry_date) {
          const normalized = normalizeExpiryDateString(extracted.expiry_date);
          session.productData.expiry_date = normalized || extracted.expiry_date;
          session.stage2.expiry_date = session.productData.expiry_date;
          session.fieldSources.expiry_date = 'STAGE_2_VISION';
        }

        if (extracted.batch_number) {
          session.productData.batch_number = extracted.batch_number;
          session.stage2.batch_number = extracted.batch_number;
          session.fieldSources.batch_number = 'STAGE_2_VISION';
        }

        if (!session.productData.name && extracted.name) {
          session.productData.name = extracted.name;
          session.fieldSources.name = 'STAGE_2_VISION';
        }

        if (!session.productData.strength && extracted.strength) {
          session.productData.strength = extracted.strength;
          session.fieldSources.strength = 'STAGE_2_VISION';
        }

        session.stage2.status = 'COMPLETED';
        session.status = 'COMPLETED';
        session.message = 'All stages complete! Expiry and batch data ready.';
      } catch (err) {
        console.error('Stage 2 processing error:', err);
        session.stage2.status = 'FAILED';
        session.stage2.error = err.message;
      }
    });

    // Immediate 202 Accepted response — non-blocking!
    res.status(202).json({
      success: true,
      queued: true,
      message: 'Stage 2 photo queued for analysis',
      data: {
        stage2Status: session.stage2.status,
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

// POST /api/v1/vision/scan-session/:sessionId (Legacy backwards-compatible single photo upload)
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

    session.status = 'PROCESSING';

    try {
      const result = await processMedicineImageBuffer(req.file.buffer, apiKey);
      session.status = 'COMPLETED';
      session.data = result.data;
      session.message = result.message;

      // Merge into productData
      if (result.data?.extracted) {
        Object.assign(session.productData, result.data.extracted);
      }
      if (result.data?.existingProduct) {
        session.existingProduct = result.data.existingProduct;
        session.isNewProduct = false;
      }

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
  connectScanSession,
  submitStage1Barcode,
  submitStage2Expiry,
};
