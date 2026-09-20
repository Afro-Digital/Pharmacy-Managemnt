const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const prisma = require('../config/database');

// Reuse normalizeExpiryDateString from productController scope — inlined here to avoid circular deps
// Smart Expiry Date Normalizer: supports YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, "07 2027", "EXP 07/2027", "07/27", Excel serials, textual dates
const normalizeExpiryDateString = (rawInput) => {
  if (!rawInput && rawInput !== 0) return null;
  let str = String(rawInput).trim();
  if (!str) return null;

  // Clean common prefixes like EXP, EXP., EXPIRY, BB, BBD, B.N., MFG, LOT, etc.
  str = str.replace(/^(?:exp(?:iry|\.|\b)?|bb(?:d)?|best\s*before|use\s*by|mfg|lot)[:.\s]*/i, '').trim();

  // 1. Excel serial number (numeric integer 30000 - 70000)
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 30000 && num <= 70000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD or YYYY MM DD
  const ymdMatch = str.match(/^(\d{4})[-/.\s]+(\d{1,2})[-/.\s]+(\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. DD-MM-YYYY or MM-DD-YYYY with [-/.\s]
  const dmyMatch = str.match(/^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})$/);
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

  // 4. DD-MM-YY with 2-digit year: e.g. 31/08/27, 31 08 27
  const dmy2Match = str.match(/^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{2})$/);
  if (dmy2Match) {
    const p1 = parseInt(dmy2Match[1], 10);
    const p2 = parseInt(dmy2Match[2], 10);
    const y = 2000 + parseInt(dmy2Match[3], 10);
    let day = p1, month = p2;
    if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
    else if (p2 > 12 && p1 <= 12) { month = p1; day = p2; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 5. Month & Year: "07 2027", "07/2027", "07-2027", "7 2027" (defaults to last day of month)
  const myMatch = str.match(/^(\d{1,2})[-/.\s]+(\d{4})$/);
  if (myMatch) {
    const m = parseInt(myMatch[1], 10);
    const y = parseInt(myMatch[2], 10);
    if (m >= 1 && m <= 12 && y >= 1990 && y <= 2100) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 6. Year & Month: "2027 07", "2027/07", "2027-07"
  const ymMatch = str.match(/^(\d{4})[-/.\s]+(\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    if (m >= 1 && m <= 12 && y >= 1990 && y <= 2100) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 7. 2-digit month & 2-digit year: "07/27", "07 27", "07-27"
  const my2Match = str.match(/^(\d{1,2})[-/.\s]+(\d{2})$/);
  if (my2Match) {
    const m = parseInt(my2Match[1], 10);
    const y = 2000 + parseInt(my2Match[2], 10);
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2099) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 8. Textual month: "Jul 2027", "July 2027", "JUL 27", "2027-Jul"
  const monthNames = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const textMonthMatch = str.match(/([a-zA-Z]{3,9})[-/.\s]+(\d{2,4})|(\d{2,4})[-/.\s]+([a-zA-Z]{3,9})/i);
  if (textMonthMatch) {
    const mStr = (textMonthMatch[1] || textMonthMatch[4]).toLowerCase().substring(0, 3);
    let y = parseInt(textMonthMatch[2] || textMonthMatch[3], 10);
    if (y < 100) y += 2000;
    const m = monthNames[mStr];
    if (m && y >= 1990 && y <= 2100) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 9. Standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1990 && y <= 2100) {
      return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  return null;
};

// --- Smart Medicine Title & Packaging Parser ---
// Extracts dosage form, strength, and packaging unit from product name or text
const parseMedicineTitle = (title) => {
  if (!title) return {};
  const str = String(title).trim();
  const result = { name: str };

  // Common dosage forms in pharmaceutical naming
  const forms = [
    { name: 'Tablet', regex: /\b(?:tablets?|tabs?|tab)\b/i },
    { name: 'Capsule', regex: /\b(?:capsules?|caps?|cap)\b/i },
    { name: 'Caplet', regex: /\bcaplets?\b/i },
    { name: 'Syrup', regex: /\b(?:syrups?|syr)\b/i },
    { name: 'Suspension', regex: /\b(?:suspensions?|susp)\b/i },
    { name: 'Injection', regex: /\b(?:injections?|inj)\b/i },
    { name: 'Cream', regex: /\b(?:creams?|crm)\b/i },
    { name: 'Ointment', regex: /\b(?:ointments?|oint)\b/i },
    { name: 'Gel', regex: /\bgels?\b/i },
    { name: 'Drops', regex: /\b(?:eye\s*drops?|ear\s*drops?|drops?)\b/i },
    { name: 'Inhaler', regex: /\binhalers?\b/i },
    { name: 'Spray', regex: /\bsprays?\b/i },
    { name: 'Solution', regex: /\b(?:solutions?|sol)\b/i },
    { name: 'Suppository', regex: /\bsuppositor(?:y|ies)\b/i },
    { name: 'Vial', regex: /\bvials?\b/i },
    { name: 'Ampule', regex: /\b(?:ampules?|ampoules?)\b/i },
    { name: 'Lotion', regex: /\blotions?\b/i },
    { name: 'Powder', regex: /\bpowders?\b/i },
    { name: 'Elixir', regex: /\belixirs?\b/i },
  ];
  for (const f of forms) {
    if (f.regex.test(str)) {
      result.dosage_form = f.name;
      break;
    }
  }

  // Strength: 500mg, 250mg/5ml, 100ml, 1%, 50mcg, 1000 IU, 1g, 10mg, etc.
  const strengthMatch = str.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|iu|%)(?:\/\d+(?:\.\d+)?\s*(?:ml|mg))?)/i);
  if (strengthMatch) {
    result.strength = strengthMatch[1].replace(/\s+/g, '');
  }

  // Packaging unit
  const units = ['Strip', 'Bottle', 'Box', 'Tube', 'Vial', 'Sachet', 'Ampule', 'Pack', 'Blister'];
  for (const u of units) {
    if (new RegExp(`\\b${u}s?\\b`, 'i').test(str)) {
      result.unit = u.toLowerCase();
      break;
    }
  }

  return result;
};

// The structured prompt sent to Gemini Vision
const EXTRACTION_PROMPT = `You are an expert pharmaceutical computer vision assistant for an Ethiopian pharmacy management system.

Analyze this medicine packaging photo carefully and extract the following fields into a structured JSON object.

CRITICAL MANDATORY INSTRUCTIONS:
1. "name": The commercial brand/trade name of the medicine as printed on the packaging (e.g. "Amoxil", "Augmentin", "Cipro 500", "Paracetamol", "Omeprazole", "Ibuprofen").
2. "dosage_form": The physical pharmaceutical formulation. MUST BE one of: "Tablet", "Capsule", "Caplet", "Syrup", "Suspension", "Injection", "Cream", "Ointment", "Gel", "Drops", "Inhaler", "Powder", "Suppository", "Vial", "Ampule", "Solution", "Lotion". If not written as explicit text, infer it from the visual packaging (e.g. blister pack = "Tablet" or "Capsule", bottle with syrup liquid = "Syrup", tube = "Cream" or "Ointment").
3. "strength": The active ingredient strength/concentration with unit (e.g. "500mg", "250mg/5ml", "100ml", "1g", "10mg", "50mcg", "1%", "2%"). Look closely near or under the medicine name.
4. "expiry_date": The expiration date printed on the packaging (e.g. "07 2027", "07/2027", "EXP 08/2026", "2027-07-31", "07-2027"). Extract it if visible anywhere on the packaging.
5. "generic_name": The active pharmaceutical ingredient / INN name (e.g. "Amoxicillin", "Paracetamol", "Ciprofloxacin").
6. "batch_number": The lot or batch number if visible (e.g. "B.N. 4920", "LOT 8812").
7. "brand": The pharmaceutical company brand name if different from generic name.
8. "manufacturer": The manufacturing company (e.g. "Cadila", "Julphar", "EPHARM", "GSK", "Pfizer").
9. "barcode": Any barcode number digits if readable near a barcode.
10. "unit": Inferred packaging unit: "Strip", "Bottle", "Box", "Tube", "Vial", "Sachet", "Ampule".

Return ONLY a valid JSON object with exactly these keys:
{
  "name": "Full product name",
  "name_am": null,
  "product_type": "MEDICINE",
  "generic_name": "Generic/INN name",
  "dosage_form": "Tablet, Capsule, Syrup, etc.",
  "strength": "Strength with unit",
  "brand": "Brand name",
  "manufacturer": "Manufacturer name",
  "batch_number": "Batch or Lot number",
  "expiry_date": "Expiry date as printed",
  "barcode": "Barcode digits or null",
  "requires_prescription": false,
  "unit": "Strip, Bottle, Box, etc.",
  "category": "Antibiotic, Analgesic, etc.",
  "description": "Short description",
  "confidence": 0.95
}

Important rules:
- Return ONLY the raw JSON object, no markdown code fences, no explanations.
- Never leave "dosage_form" or "strength" null if they can be determined from the text or visual package.`;

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
    extracted.expiry_date = normalized || null;
  }

  // Smart Title & Text Fallback for Dosage Form, Strength, and Unit
  const parsedFromText = parseMedicineTitle(
    `${extracted.name || ''} ${extracted.description || ''} ${extracted.generic_name || ''}`
  );
  if (!extracted.dosage_form && parsedFromText.dosage_form) {
    extracted.dosage_form = parsedFromText.dosage_form;
  }
  if (!extracted.strength && parsedFromText.strength) {
    extracted.strength = parsedFromText.strength;
  }
  if (!extracted.unit && parsedFromText.unit) {
    extracted.unit = parsedFromText.unit;
  }

  // If still missing dosage_form for a MEDICINE, check common clues
  if (!extracted.dosage_form && extracted.product_type === 'MEDICINE') {
    const combined = `${extracted.name || ''} ${extracted.description || ''}`.toLowerCase();
    if (combined.includes('oral') || combined.includes('pill') || combined.includes('tablet') || combined.includes('tab')) {
      extracted.dosage_form = 'Tablet';
    } else if (combined.includes('capsule') || combined.includes('cap')) {
      extracted.dosage_form = 'Capsule';
    } else if (combined.includes('syrup') || combined.includes('liquid') || combined.includes('suspension')) {
      extracted.dosage_form = 'Syrup';
    }
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

// --- Universal Barcode Drug Identification & Enrichment Service ---

// 2. Query UPCitemdb (Global barcode database with millions of pharmaceuticals & health items)
const lookupUPCItemDB = async (barcode) => {
  if (!barcode || !/^\d{8,14}$/.test(barcode.trim())) return null;
  const cleanCode = barcode.trim();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanCode}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TilexPharmacy/1.0 (info@tilexpharma.com)' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (json?.items && json.items.length > 0) {
      const item = json.items[0];
      const parsed = parseMedicineTitle(item.title || '');
      return {
        name: item.title ? item.title.trim() : null,
        brand: item.brand ? item.brand.trim() : null,
        category: item.category || null,
        description: item.description || null,
        dosage_form: parsed.dosage_form || null,
        strength: parsed.strength || null,
        unit: parsed.unit || null,
        source: 'UPCITEMDB',
      };
    }
  } catch (e) {
    // Silently ignore network / timeout errors
  }
  return null;
};

// 3. Query OpenFDA Drug Directory (US FDA NDC registry for pharmaceuticals)
const lookupOpenFDADrug = async (barcode) => {
  if (!barcode || !/^\d{8,14}$/.test(barcode.trim())) return null;
  const cleanCode = barcode.trim();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(
      `https://api.fda.gov/drug/ndc.json?search=packaging.package_ndc:${cleanCode}&limit=1`,
      {
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (json?.results && json.results.length > 0) {
      const drug = json.results[0];
      return {
        name: drug.brand_name || drug.generic_name || null,
        generic_name: drug.generic_name || null,
        dosage_form: drug.dosage_form ? drug.dosage_form.split(',')[0].trim() : null,
        brand: drug.brand_name || drug.labeler_name || null,
        manufacturer: drug.labeler_name || null,
        product_type: 'MEDICINE',
        requires_prescription: drug.product_type ? !drug.product_type.includes('OTC') : true,
        source: 'OPENFDA',
      };
    }
  } catch (e) {
    // Silently ignore network / timeout errors
  }
  return null;
};

// 4. Query Open Products Facts & Open Food Facts
const lookupOpenProductsFacts = async (barcode) => {
  if (!barcode || !/^\d{8,14}$/.test(barcode.trim())) return null;
  const cleanCode = barcode.trim();
  const endpoints = [
    `https://world.openproductsfacts.org/api/v2/product/${cleanCode}.json?fields=product_name,generic_name,brands,categories,quantity`,
    `https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json?fields=product_name,generic_name,brands,categories,quantity`,
  ];
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TilexPharmacy/1.0 (info@tilexpharma.com)' },
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const json = await resp.json();
        if (json?.status === 1 && json.product?.product_name) {
          const p = json.product;
          const parsed = parseMedicineTitle(p.product_name);
          return {
            name: p.product_name.trim(),
            generic_name: p.generic_name ? p.generic_name.trim() : null,
            brand: p.brands ? p.brands.split(',')[0].trim() : null,
            dosage_form: parsed.dosage_form || null,
            strength: parsed.strength || null,
            unit: parsed.unit || null,
            source: 'OPEN_PRODUCTS_FACTS',
          };
        }
      }
    } catch (e) {
      // Continue to next endpoint
    }
  }
  return null;
};

// 5. Query Gemini Generative AI for Drug Identification by Barcode (and optional photo)
const identifyDrugWithGemini = async ({ barcode, apiKey, imageBuffer, hintTitle }) => {
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const primaryModelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

    const prompt = `You are an expert clinical pharmacist and pharmaceutical catalog AI.
The user scanned a medicine/health product with barcode number: "${barcode || 'N/A'}"
${hintTitle ? `Database lookup hint for this barcode: "${hintTitle}"` : ''}
${imageBuffer ? 'An image of the barcode / packaging is attached for visual inspection.' : ''}

Task: Identify the exact medicine/drug product associated with this barcode or photo.
Return ONLY a valid JSON object with the following fields:
{
  "found": true,
  "name": "Full official commercial medicine name (e.g. Augmentin 625mg, Panadol Extra, Amoxicillin 500mg, Tylenol 500mg)",
  "name_am": "Amharic name if known in Ethiopian pharmacy practice, otherwise null",
  "generic_name": "Active pharmaceutical ingredient / INN (e.g. Amoxicillin + Clavulanate, Paracetamol, Ibuprofen)",
  "dosage_form": "Tablet, Capsule, Syrup, Suspension, Injection, Cream, Ointment, Drops, Inhaler, Gel, Solution, etc.",
  "strength": "Dosage strength with unit (e.g. 500mg, 250mg/5ml, 100ml, 1g)",
  "brand": "Brand name or trademark owner (e.g. GSK, Sanofi, Cipla, Pfizer, Novartis)",
  "manufacturer": "Manufacturing pharmaceutical company if known",
  "product_type": "MEDICINE",
  "unit": "Packaging unit: strip, bottle, box, tube, vial, ampule, sachet",
  "category": "Therapeutic class (e.g. Antibiotic, Analgesic, Antipyretic, Antacid, Antihistamine, Vitamin)",
  "requires_prescription": true if Rx / prescription required; false if OTC
}
If you cannot identify this barcode as a specific pharmaceutical or health product, return {"found": false}.
Return ONLY the JSON object, no markdown code fences, no extra text.`;

    const contents = [prompt];
    if (imageBuffer) {
      try {
        const processedImg = await sharp(imageBuffer)
          .resize({ width: 1024, withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        contents.push({
          inlineData: {
            data: processedImg.toString('base64'),
            mimeType: 'image/jpeg',
          },
        });
      } catch (e) {
        // Ignore sharp failure
      }
    }

    let resultText = null;
    const models = [primaryModelName, 'gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.generateContent(contents);
        resultText = res.response.text();
        if (resultText) break;
      } catch (e) {
        console.warn(`Model ${m} barcode lookup failed:`, e.message);
      }
    }

    if (!resultText) return null;

    let clean = resultText.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(clean);
    if (parsed && parsed.found !== false && parsed.name) {
      return parsed;
    }
  } catch (err) {
    console.warn('Gemini drug identification error:', err.message);
  }
  return null;
};

// 6. Master Barcode Drug Enrichment Pipeline: queries local DB, external registries & AI
const enrichMedicineFromBarcode = async ({ barcode, imageBuffer, apiKey }) => {
  if (!barcode && !imageBuffer) return null;
  const cleanCode = barcode ? String(barcode).trim() : null;

  // Query global registries in parallel
  let registryData = null;
  if (cleanCode && /^\d{6,14}$/.test(cleanCode)) {
    const [fdaRes, upcRes, openProductsRes] = await Promise.allSettled([
      lookupOpenFDADrug(cleanCode),
      lookupUPCItemDB(cleanCode),
      lookupOpenProductsFacts(cleanCode),
    ]);

    if (fdaRes.status === 'fulfilled' && fdaRes.value) {
      registryData = fdaRes.value;
    } else if (upcRes.status === 'fulfilled' && upcRes.value) {
      registryData = upcRes.value;
    } else if (openProductsRes.status === 'fulfilled' && openProductsRes.value) {
      registryData = openProductsRes.value;
    }
  }

  // Query Gemini AI with barcode digits and any registry hint
  let geminiData = null;
  if (apiKey) {
    geminiData = await identifyDrugWithGemini({
      barcode: cleanCode,
      apiKey,
      imageBuffer,
      hintTitle: registryData?.name || registryData?.brand_name || null,
    });
  }

  // Synthesize best available information
  const finalName = geminiData?.name || registryData?.name || null;
  if (!finalName && !geminiData) {
    return null;
  }

  const parsedFromTitle = parseMedicineTitle(finalName || '');

  const enriched = {
    barcode: cleanCode || geminiData?.barcode || null,
    name: finalName,
    name_am: geminiData?.name_am || null,
    product_type: geminiData?.product_type || 'MEDICINE',
    generic_name: geminiData?.generic_name || registryData?.generic_name || null,
    dosage_form: geminiData?.dosage_form || registryData?.dosage_form || parsedFromTitle.dosage_form || 'Tablet',
    strength: geminiData?.strength || registryData?.strength || parsedFromTitle.strength || null,
    brand: geminiData?.brand || registryData?.brand || null,
    manufacturer: geminiData?.manufacturer || registryData?.manufacturer || null,
    unit: (geminiData?.unit || registryData?.unit || parsedFromTitle.unit || 'strip').toLowerCase(),
    category: geminiData?.category || registryData?.category || null,
    requires_prescription:
      geminiData?.requires_prescription !== undefined
        ? geminiData.requires_prescription
        : registryData?.requires_prescription !== undefined
        ? registryData.requires_prescription
        : false,
    source: geminiData ? 'GEMINI_AI_REGISTRY' : registryData?.source || 'GLOBAL_BARCODE_CATALOG',
  };

  // Auto-match category from TilexPharmacy database
  if (enriched.category) {
    try {
      const cat = await prisma.category.findFirst({
        where: {
          name: { contains: enriched.category, mode: 'insensitive' },
        },
      });
      if (cat) enriched.category_id = cat.id;
    } catch (e) {
      // Ignore DB category match error
    }
  }

  return enriched;
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
        error: { code: 'MISSING_BARCODE', message: 'Barcode string or packaging image is required' },
      });
    }

    session.stage1.status = 'PROCESSING';
    session.status = 'PROCESSING';
    session.message = 'Processing Stage 1: Analyzing product image with AI...';

    const fileBuffer = req.file ? req.file.buffer : null;
    const barcodeInput = barcode ? String(barcode).trim() : null;

    try {
      let code = barcodeInput;

      // 1. If an image was submitted, run Gemini Vision packaging extraction
      if (fileBuffer) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          try {
            const res = await processMedicineImageBuffer(fileBuffer, apiKey);
            if (res?.data?.extracted) {
              const ext = res.data.extracted;
              if (!code && ext.barcode) {
                code = ext.barcode;
              }
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
                batch_number: ext.batch_number || session.productData.batch_number,
                expiry_date: ext.expiry_date || session.productData.expiry_date,
                requires_prescription:
                  ext.requires_prescription !== undefined
                    ? ext.requires_prescription
                    : session.productData.requires_prescription,
                category_id: res.data.matchedCategoryId || session.productData.category_id,
              });
              session.fieldSources.name = 'STAGE_1_PACKAGING_SCAN';
              session.fieldSources.dosage_form = 'STAGE_1_PACKAGING_SCAN';
              session.fieldSources.strength = 'STAGE_1_PACKAGING_SCAN';
              if (ext.expiry_date) session.fieldSources.expiry_date = 'STAGE_1_PACKAGING_SCAN';
              if (ext.batch_number) session.fieldSources.batch_number = 'STAGE_1_PACKAGING_SCAN';
            }
          } catch (vErr) {
            console.warn('Packaging extraction failed:', vErr.message);
          }
        }
      }

      // 2. Barcode resolution & Drug Database / AI Enrichment
      if (code) {
        session.stage1.barcode = code;
        session.productData.barcode = code;
        session.fieldSources.barcode = 'STAGE_1_BARCODE';

        // Check local database for existing product match
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
            name_am: existing.name_am || session.productData.name_am,
            product_type: existing.product_type,
            generic_name: existing.generic_name || session.productData.generic_name,
            dosage_form: existing.dosage_form || session.productData.dosage_form,
            strength: existing.strength || session.productData.strength,
            brand: existing.brand || session.productData.brand,
            manufacturer: existing.manufacturer || session.productData.manufacturer,
            unit_price: existing.unit_price,
            unit: existing.unit || session.productData.unit || 'strip',
            category_id: existing.category_id || session.productData.category_id,
            requires_prescription: existing.requires_prescription,
          });
          session.fieldSources.name = 'EXISTING_DB';
          session.fieldSources.dosage_form = 'EXISTING_DB';
          session.fieldSources.strength = 'EXISTING_DB';
          session.fieldSources.unit_price = 'EXISTING_DB';
        } else {
          // New product: Auto-identify medicine details from barcode via multi-source engine!
          const apiKey = process.env.GEMINI_API_KEY;
          const enriched = await enrichMedicineFromBarcode({
            barcode: code,
            imageBuffer: fileBuffer,
            apiKey,
          });

          if (enriched && enriched.name) {
            Object.assign(session.productData, {
              barcode: code,
              name: enriched.name,
              name_am: enriched.name_am || session.productData.name_am,
              product_type: enriched.product_type || session.productData.product_type,
              generic_name: enriched.generic_name || session.productData.generic_name,
              dosage_form: enriched.dosage_form || session.productData.dosage_form,
              strength: enriched.strength || session.productData.strength,
              brand: enriched.brand || session.productData.brand,
              manufacturer: enriched.manufacturer || session.productData.manufacturer,
              unit: enriched.unit || session.productData.unit || 'strip',
              category_id: enriched.category_id || session.productData.category_id,
              requires_prescription: enriched.requires_prescription,
            });
            session.fieldSources.name = enriched.source;
            session.fieldSources.dosage_form = enriched.source;
            session.fieldSources.strength = enriched.source;

            session.isNewProduct = true;
            session.stage1.productFound = false;
            session.stage1.message = `✨ Auto-identified: "${enriched.name}" (${enriched.strength || ''} ${enriched.dosage_form || ''}) from barcode!`;
          } else {
            session.isNewProduct = true;
            session.stage1.productFound = false;
            session.stage1.message = session.productData.name
              ? `Detected "${session.productData.name}" (Barcode: ${code})`
              : `Barcode "${code}" detected (New product).`;
          }
        }
      } else if (session.productData.name) {
        // Match existing product by name in database if barcode is absent
        try {
          const existingByName = await prisma.product.findFirst({
            where: { name: { equals: session.productData.name, mode: 'insensitive' } },
            include: { category: true },
          });
          if (existingByName) {
            if (!session.productData.dosage_form) session.productData.dosage_form = existingByName.dosage_form;
            if (!session.productData.strength) session.productData.strength = existingByName.strength;
            if (!session.productData.category_id) session.productData.category_id = existingByName.category_id;
            if (!session.productData.unit_price) session.productData.unit_price = existingByName.unit_price;
            if (!session.productData.barcode && existingByName.barcode) session.productData.barcode = existingByName.barcode;
            session.isNewProduct = false;
            session.stage1.productFound = true;
            session.stage1.message = `Found existing product in inventory: "${existingByName.name}".`;
          }
        } catch (e) {
          // Ignore lookup error
        }
        if (!session.stage1.message) {
          session.stage1.message = `Detected product "${session.productData.name}" (${session.productData.dosage_form || ''} ${session.productData.strength || ''}) via packaging scan.`;
        }
      }

      session.stage1.status = 'COMPLETED';
      if (session.stage2.status !== 'PROCESSING' && session.stage2.status !== 'QUEUED') {
        session.message = session.productData.name
          ? `Stage 1 Complete: "${session.productData.name}" detected (${session.productData.dosage_form || ''} ${session.productData.strength || ''}). Ready for Stage 2: Expiry & Batch.`
          : 'Stage 1 Complete: Packaging analyzed.';
      }
    } catch (err) {
      console.error('Stage 1 processing error:', err);
      session.stage1.status = 'FAILED';
      session.stage1.error = err.message;
    }

    res.json({
      success: true,
      message: 'Packaging analyzed successfully',
      data: {
        stage1Status: session.stage1.status,
        barcode: session.productData.barcode || barcodeInput,
        productData: session.productData,
        fieldSources: session.fieldSources,
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
          session.productData.expiry_date = normalized || null;
          session.stage2.expiry_date = normalized || extracted.expiry_date;
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
      // If not in local database, auto-enrich from global registries & AI!
      const apiKey = process.env.GEMINI_API_KEY;
      const cleanCode = barcode.trim();
      const enriched = await enrichMedicineFromBarcode({ barcode: cleanCode, apiKey });

      if (enriched && enriched.name) {
        return res.json({
          success: true,
          data: {
            found: false,
            enriched: true,
            barcode: cleanCode,
            product: {
              name: enriched.name,
              name_am: enriched.name_am || '',
              product_type: enriched.product_type || 'MEDICINE',
              generic_name: enriched.generic_name || '',
              dosage_form: enriched.dosage_form || 'Tablet',
              strength: enriched.strength || '',
              brand: enriched.brand || '',
              manufacturer: enriched.manufacturer || '',
              unit_price: '',
              unit: enriched.unit || 'strip',
              barcode: cleanCode,
              sku: cleanCode,
              category_id: enriched.category_id || '',
              category: enriched.category ? { name: enriched.category } : null,
              requires_prescription: enriched.requires_prescription || false,
              source: enriched.source,
            },
          },
          message: `✨ Identified "${enriched.name}" (${enriched.strength || ''} ${enriched.dosage_form || ''}) from barcode!`,
        });
      }

      return res.json({
        success: true,
        data: { found: false, enriched: false, barcode: cleanCode },
        message: `No product found with barcode "${cleanCode}". You can create a new product.`,
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

// PATCH /api/v1/vision/scan-session/:sessionId/fields — Update product fields manually (Stage 3)
const updateScanSessionFields = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = scanSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Scan session not found or expired' },
      });
    }

    const allowed = ['name', 'dosage_form', 'strength', 'expiry_date', 'batch_number', 'unit', 'unit_price', 'barcode', 'generic_name'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'expiry_date') {
          session.productData[key] = normalizeExpiryDateString(req.body[key]) || req.body[key];
        } else {
          session.productData[key] = req.body[key];
        }
        session.fieldSources[key] = 'STAGE_3_MANUAL';
      }
    }

    res.json({
      success: true,
      message: 'Product fields updated successfully',
      data: {
        productData: session.productData,
        fieldSources: session.fieldSources,
      },
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
  updateScanSessionFields,
};

