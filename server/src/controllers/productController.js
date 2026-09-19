const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');

// Auto-generate standard numerical barcode (e.g., 12-digit code starting with 890)
const generateBarcode = () => {
  const prefix = '890';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}${timestamp}${random}`;
};

// Auto-generate SKU (e.g. MED-AMX-4821 or COS-NIV-1928)
const generateSku = (productType = 'MEDICINE', name = '') => {
  const prefix = (productType || '').toUpperCase() === 'COSMETIC' ? 'COS' : 'MED';
  const cleanName = (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${cleanName}-${randomSuffix}`;
};

// GET /api/v1/products
const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const { search, product_type, category_id, is_active, sort, order } = req.query;

    const where = {};
    if (product_type) where.product_type = product_type;
    if (category_id) where.category_id = category_id;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    else where.is_active = true;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { name_am: { contains: search, mode: 'insensitive' } },
        { generic_name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = {};
    if (sort) orderBy[sort] = order === 'desc' ? 'desc' : 'asc';
    else orderBy.created_at = 'desc';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit, orderBy,
        include: {
          category: true,
          inventory: {
            select: {
              id: true,
              location: true,
              batch_number: true,
              expiry_date: true,
              quantity: true,
              shelf_location: true,
            },
            orderBy: { expiry_date: 'asc' },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/search?q=...
const searchProducts = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { name_am: { contains: q, mode: 'insensitive' } },
          { generic_name: { contains: q, mode: 'insensitive' } },
          { barcode: { equals: q, mode: 'insensitive' } },
        ],
      },
      include: {
        category: true,
        inventory: {
          where: { location: 'DISPENSARY', quantity: { gt: 0 } },
        },
      },
      take: 20,
    });

    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/:id
const getProduct = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        inventory: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/products
const createProduct = async (req, res, next) => {
  try {
    const {
      name, name_am, generic_name, category_id, product_type,
      dosage_form, strength, brand, manufacturer, unit_price,
      reorder_level, requires_prescription, barcode, sku, unit, description,
      expiry_date, batch_number, initial_quantity, quantity, initial_location,
    } = req.body;

    const missingFields = [];
    if (!name || !name.trim()) missingFields.push('Name');
    if (!product_type || !['MEDICINE', 'COSMETIC'].includes(product_type.toUpperCase().trim())) {
      missingFields.push('Product Type (MEDICINE or COSMETIC)');
    }

    const parsedPrice = parseFloat(unit_price);
    if (unit_price === undefined || unit_price === null || unit_price === '' || isNaN(parsedPrice) || parsedPrice < 0) {
      missingFields.push('Unit Price (ETB)');
    }

    if (requires_prescription === undefined || requires_prescription === null || requires_prescription === '') {
      missingFields.push('Requires Prescription');
    }

    if (!expiry_date || !expiry_date.toString().trim()) {
      missingFields.push('Expiry Date');
    } else {
      const parsedDate = new Date(expiry_date);
      if (isNaN(parsedDate.getTime())) {
        missingFields.push('Valid Expiry Date (YYYY-MM-DD)');
      }
    }

    if (!batch_number || !batch_number.toString().trim()) {
      missingFields.push('Batch Number');
    }

    const qtyVal = initial_quantity !== undefined && initial_quantity !== '' ? initial_quantity : quantity;
    const parsedQty = parseInt(qtyVal);
    if (qtyVal === undefined || qtyVal === null || qtyVal === '' || isNaN(parsedQty) || parsedQty < 0) {
      missingFields.push('Quantity');
    }

    if (!unit || !unit.toString().trim()) {
      missingFields.push('Unit (bottle, strip, sachet, ampule, etc.)');
    }

    if (!dosage_form || !dosage_form.toString().trim()) {
      missingFields.push('Dosage Form');
    }

    if (!strength || !strength.toString().trim()) {
      missingFields.push('Strength (e.g., 100mg, 50g)');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_REQUIRED_FIELDS',
          message: `All 10 required fields must be filled: ${missingFields.join(', ')}`,
          missingFields,
        },
      });
    }

    const finalBarcode = (barcode && barcode.trim()) || generateBarcode();
    const finalSku = (sku && sku.trim()) || generateSku(product_type, name);
    const parsedRx = typeof requires_prescription === 'boolean'
      ? requires_prescription
      : String(requires_prescription).toLowerCase() === 'true';

    const product = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          name: name.trim(),
          name_am: name_am ? name_am.trim() : null,
          generic_name: generic_name ? generic_name.trim() : null,
          category_id: category_id || null,
          product_type: product_type.toUpperCase().trim(),
          dosage_form: dosage_form.trim(),
          strength: strength.trim(),
          brand: brand ? brand.trim() : null,
          manufacturer: manufacturer ? manufacturer.trim() : null,
          unit_price: parsedPrice,
          reorder_level: reorder_level ? parseInt(reorder_level) : 10,
          requires_prescription: parsedRx,
          barcode: finalBarcode,
          sku: finalSku,
          unit: unit.trim(),
          description: description ? description.trim() : null,
        },
        include: { category: true },
      });

      const loc = initial_location === 'DISPENSARY' ? 'DISPENSARY' : 'STORE';
      const inv = await tx.inventory.create({
        data: {
          product_id: prod.id,
          location: loc,
          batch_number: batch_number.trim(),
          expiry_date: new Date(expiry_date),
          quantity: parsedQty,
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'ADD_STOCK',
          entity_type: 'INVENTORY',
          entity_id: inv.id,
          details: {
            product_id: prod.id,
            location: loc,
            expiry_date,
            batch_number: batch_number.trim(),
            quantity: parsedQty,
          },
        },
      });

      return prod;
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'CREATE', entity_type: 'PRODUCT',
        entity_id: product.id, details: { name: product.name, product_type, barcode: finalBarcode, sku: finalSku },
      },
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, inventory: true },
    });

    res.status(201).json({ success: true, data: fullProduct, message: 'Product created successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, name_am, generic_name, category_id, product_type,
      dosage_form, strength, brand, manufacturer, unit_price,
      reorder_level, requires_prescription, barcode, sku, unit, description, is_active,
      expiry_date, batch_number, inventory_id,
    } = req.body;

    const product = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (name_am !== undefined) updateData.name_am = name_am;
      if (generic_name !== undefined) updateData.generic_name = generic_name;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (product_type !== undefined) updateData.product_type = product_type;
      if (dosage_form !== undefined) updateData.dosage_form = dosage_form;
      if (strength !== undefined) updateData.strength = strength;
      if (brand !== undefined) updateData.brand = brand;
      if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
      if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price);
      if (reorder_level !== undefined) updateData.reorder_level = parseInt(reorder_level);
      if (requires_prescription !== undefined) updateData.requires_prescription = requires_prescription;
      if (barcode !== undefined) updateData.barcode = barcode;
      if (sku !== undefined) updateData.sku = sku;
      if (unit !== undefined) updateData.unit = unit;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      const updated = await tx.product.update({
        where: { id },
        data: updateData,
      });

      // Update or set expiration date and batch on inventory
      if (expiry_date !== undefined || batch_number !== undefined) {
        const parsedExpiry = expiry_date ? new Date(expiry_date) : null;
        if (inventory_id) {
          const invUpdate = {};
          if (expiry_date !== undefined) invUpdate.expiry_date = parsedExpiry;
          if (batch_number !== undefined) invUpdate.batch_number = batch_number || null;

          await tx.inventory.update({
            where: { id: inventory_id },
            data: invUpdate,
          });
        } else {
          // If no specific inventory_id, update the most recent inventory batch or create one
          const existingInv = await tx.inventory.findFirst({
            where: { product_id: id },
            orderBy: { created_at: 'desc' },
          });

          if (existingInv) {
            const invUpdate = {};
            if (expiry_date !== undefined) invUpdate.expiry_date = parsedExpiry;
            if (batch_number !== undefined) invUpdate.batch_number = batch_number || null;

            await tx.inventory.update({
              where: { id: existingInv.id },
              data: invUpdate,
            });
          } else if (parsedExpiry || batch_number) {
            await tx.inventory.create({
              data: {
                product_id: id,
                location: 'STORE',
                batch_number: batch_number || null,
                expiry_date: parsedExpiry,
                quantity: 0,
              },
            });
          }
        }
      }

      return updated;
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'UPDATE', entity_type: 'PRODUCT',
        entity_id: product.id, details: { updated_fields: Object.keys(req.body) },
      },
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, inventory: true },
    });

    res.json({ success: true, data: fullProduct, message: 'Product updated successfully' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/products/:id (soft delete)
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.product.update({
      where: { id },
      data: { is_active: false },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'SOFT_DELETE', entity_type: 'PRODUCT',
        entity_id: id,
      },
    });

    res.json({ success: true, message: 'Product deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/low-stock
const getLowStock = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { is_active: true },
      include: {
        inventory: true,
        category: true,
      },
    });

    const lowStockProducts = products.filter((p) => {
      const totalQty = p.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      return totalQty <= p.reorder_level;
    }).map((p) => ({
      ...p,
      total_quantity: p.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
    }));

    res.json({ success: true, data: lowStockProducts });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/expiring?days=30
const getExpiring = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const inventory = await prisma.inventory.findMany({
      where: {
        expiry_date: { lte: futureDate, gte: new Date() },
        quantity: { gt: 0 },
      },
      include: { product: { include: { category: true } } },
      orderBy: { expiry_date: 'asc' },
    });

    res.json({ success: true, data: inventory });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/products/import-template
const getImportTemplate = (req, res) => {
  const headers = [
    'Name',
    'Name_Amharic',
    'Product_Type',
    'Category',
    'Generic_Name',
    'Dosage_Form',
    'Strength',
    'Brand',
    'Manufacturer',
    'Unit_Price_ETB',
    'Reorder_Level',
    'Barcode',
    'SKU',
    'Requires_Prescription',
    'Expiry_Date',
    'Batch_Number',
    'Quantity',
    'Unit',
    'Description',
  ];

  const samples = [
    [
      'Amoxicillin 500mg',
      'አሞክሲሊን 500mg',
      'MEDICINE',
      'Antibiotics',
      'Amoxicillin',
      'Capsule',
      '500mg',
      'Epharm',
      'Ethiopian Pharmaceuticals',
      '18.50',
      '20',
      'MED-AMX-500',
      'MED-AMX-101',
      'true',
      '2027-08-31',
      'BATCH-AMX-2025',
      '100',
      'Strip',
      'Broad-spectrum antibiotic for bacterial infections',
    ],
    [
      'Paracetamol 500mg',
      'ፓራሲታሞል 500mg',
      'MEDICINE',
      'Pain Relief',
      'Paracetamol',
      'Tablet',
      '500mg',
      'Cadila',
      'Cadila Pharmaceuticals',
      '5.00',
      '50',
      'MED-PCM-500',
      'MED-PCM-102',
      'false',
      '2028-01-15',
      'BATCH-PCM-2025',
      '250',
      'Strip',
      'Analgesic and antipyretic for pain and fever',
    ],
    [
      'Nivea Soft Moisturizing Cream',
      'ኒቪያ ሶፍት ክሬም',
      'COSMETIC',
      'Skincare',
      '',
      'Cream',
      '200ml',
      'Nivea',
      'Beiersdorf',
      '350.00',
      '15',
      'COS-NIV-200',
      'COS-NIV-103',
      'false',
      '2026-12-31',
      'BATCH-NIV-2024',
      '30',
      'Bottle',
      'Refreshing soft moisturizing cream with Jojoba oil',
    ],
  ];

  const csv = [
    headers.join(','),
    ...samples.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.csv');
  res.send(csv);
};

// POST /api/v1/products/bulk-upload
const bulkUploadProducts = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'An array of products is required for bulk upload' },
      });
    }

    const categories = await prisma.category.findMany();
    const categoryMap = new Map();
    categories.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase().trim(), cat.id);
    });

    const results = {
      total: products.length,
      successCount: 0,
      createdCount: 0,
      updatedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
      duplicates: [],
      errors: [],
      created: [],
      updated: [],
    };

    // In-memory registries to track products & batches processed during this import
    // Map: normalizedNameKey -> productObject
    const processedProducts = new Map();
    // Set: `${productId}__${batchNumber}`
    const processedBatches = new Set();

    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      const rowNum = i + 1;

      const rawName = (item.name || item.Name || '').trim();
      const rawType = (item.product_type || item.Product_Type || 'MEDICINE').toUpperCase().trim();
      const rawPriceVal = item.unit_price !== undefined ? item.unit_price : (item.Unit_Price_ETB !== undefined ? item.Unit_Price_ETB : (item.unit_price_etb !== undefined ? item.unit_price_etb : item['Unit Price']));
      const rawRxVal = item.requires_prescription !== undefined ? item.requires_prescription : (item.Requires_Prescription !== undefined ? item.Requires_Prescription : item.requires_rx);
      const expiryRaw = (item.expiry_date || item.Expiry_Date || item['Expiry Date'] || '').toString().trim();
      const batchRaw = (item.batch_number || item.Batch_Number || item['Batch Number'] || '').toString().trim();
      const qtyRawStr = item.quantity !== undefined ? item.quantity : (item.Quantity !== undefined ? item.Quantity : (item.initial_quantity !== undefined ? item.initial_quantity : item['Qty']));
      const rawUnit = (item.unit || item.Unit || item['Unit(bottle, stp, sachets, ampule)'] || item['Packaging Unit'] || '').toString().trim();
      const rawDosageForm = (item.dosage_form || item.Dosage_Form || item['Dosage Form'] || '').toString().trim();
      const rawStrength = (item.strength || item.Strength || '').toString().trim();
      const rawBarcode = (item.barcode || item.Barcode || '').toString().trim();
      const rawSku = (item.sku || item.SKU || '').toString().trim();

      const nameLookupKey = rawName.toLowerCase();
      const compositeKey = `${nameLookupKey}|${rawStrength.toLowerCase()}|${rawDosageForm.toLowerCase()}`;

      try {
        // ── 1. Find existing product (prevent duplicating the product catalog) ──
        let existingProduct = null;

        // A. Check in-memory processed products from this import batch first
        if (rawBarcode && processedProducts.has(`barcode_${rawBarcode.toLowerCase()}`)) {
          existingProduct = processedProducts.get(`barcode_${rawBarcode.toLowerCase()}`);
        } else if (processedProducts.has(compositeKey)) {
          existingProduct = processedProducts.get(compositeKey);
        } else if (processedProducts.has(nameLookupKey)) {
          existingProduct = processedProducts.get(nameLookupKey);
        }

        // B. Check database if not found in current batch memory
        if (!existingProduct) {
          if (rawBarcode) {
            existingProduct = await prisma.product.findFirst({
              where: { barcode: rawBarcode, is_active: true },
            });
          }

          if (!existingProduct) {
            const candidates = await prisma.product.findMany({
              where: {
                name: { equals: rawName, mode: 'insensitive' },
                is_active: true,
              },
            });

            if (candidates.length === 1) {
              existingProduct = candidates[0];
            } else if (candidates.length > 1) {
              const matched = candidates.find((c) =>
                (rawStrength ? (c.strength || '').toLowerCase().trim() === rawStrength.toLowerCase() : true) &&
                (rawDosageForm ? (c.dosage_form || '').toLowerCase().trim() === rawDosageForm.toLowerCase() : true)
              );
              existingProduct = matched || candidates[0];
            }
          }
        }

        // Determine effective values (reusing existing catalog values if row omitted non-batch metadata)
        const effectiveType = rawType || (existingProduct ? existingProduct.product_type : 'MEDICINE');
        const effectiveDosageForm = rawDosageForm || (existingProduct ? existingProduct.dosage_form : '') || '';
        const effectiveStrength = rawStrength || (existingProduct ? existingProduct.strength : '') || '';
        const effectiveUnit = rawUnit || (existingProduct ? existingProduct.unit : '') || '';
        const effectiveRx = rawRxVal !== undefined && rawRxVal !== '' ? rawRxVal : (existingProduct ? existingProduct.requires_prescription : true);

        // ── 2. Validate all 10 required fields ──
        const missingRowFields = [];
        if (!rawName) missingRowFields.push('Name');
        if (!effectiveType || !['MEDICINE', 'COSMETIC'].includes(effectiveType)) {
          missingRowFields.push('Product Type (MEDICINE or COSMETIC)');
        }

        const priceCandidate = rawPriceVal !== undefined && rawPriceVal !== '' ? rawPriceVal : (existingProduct ? existingProduct.unit_price : NaN);
        const unitPrice = parseFloat(priceCandidate);
        if (priceCandidate === undefined || priceCandidate === null || isNaN(unitPrice) || unitPrice < 0) {
          missingRowFields.push('Unit Price (ETB)');
        }

        if (effectiveRx === undefined || effectiveRx === null || effectiveRx === '') {
          missingRowFields.push('Requires Prescription');
        }

        let parsedExpiry = null;
        if (!expiryRaw) {
          missingRowFields.push('Expiry Date');
        } else {
          const parsed = new Date(expiryRaw);
          if (isNaN(parsed.getTime())) {
            missingRowFields.push('Valid Expiry Date (YYYY-MM-DD)');
          } else {
            parsedExpiry = parsed;
          }
        }

        if (!batchRaw) missingRowFields.push('Batch Number');

        const qtyParsed = parseInt(qtyRawStr);
        if (qtyRawStr === undefined || qtyRawStr === null || qtyRawStr === '' || isNaN(qtyParsed) || qtyParsed < 0) {
          missingRowFields.push('Quantity');
        }

        if (!effectiveUnit) missingRowFields.push('Unit (bottle, strip, sachet, ampule, etc.)');
        if (!effectiveDosageForm) missingRowFields.push('Dosage Form');
        if (!effectiveStrength) missingRowFields.push('Strength (e.g., 100mg, 50g)');

        if (missingRowFields.length > 0) {
          results.failedCount++;
          results.errors.push({
            row: rowNum,
            name: rawName || 'Unnamed',
            error: `Row ${rowNum} ("${rawName || 'Unnamed'}") missing required fields: ${missingRowFields.join(', ')}`,
            missingFields: missingRowFields,
          });
          continue; // Do NOT save product or inventory if required fields are incomplete
        }

        const productType = effectiveType === 'COSMETIC' ? 'COSMETIC' : 'MEDICINE';
        const requiresRx = String(effectiveRx).toLowerCase() === 'true';
        const finalBarcode = rawBarcode || (existingProduct ? existingProduct.barcode : '') || generateBarcode();
        const finalSku = rawSku || (existingProduct ? existingProduct.sku : '') || generateSku(productType, rawName);

        const catName = (item.category || item.Category || '').toLowerCase().trim();
        let categoryId = categoryMap.get(catName);
        if (!categoryId) {
          const fallbackCat = categories.find((c) => c.type === productType);
          categoryId = fallbackCat ? fallbackCat.id : null;
        }

        const reorderLevel = parseInt(item.reorder_level || item.Reorder_Level) || 10;

        // ── 3. Handle Case: Product Already Exists ──
        if (existingProduct) {
          // Register in memory
          processedProducts.set(nameLookupKey, existingProduct);
          processedProducts.set(compositeKey, existingProduct);
          if (existingProduct.barcode) {
            processedProducts.set(`barcode_${existingProduct.barcode.toLowerCase()}`, existingProduct);
          }

          const batchKey = `${existingProduct.id}__${batchRaw.toLowerCase()}`;

          // Check if this batch already exists in inventory (or was processed earlier in this import)
          let batchAlreadyExists = processedBatches.has(batchKey);

          if (!batchAlreadyExists) {
            const existingInventory = await prisma.inventory.findFirst({
              where: {
                product_id: existingProduct.id,
                location: 'STORE',
                batch_number: { equals: batchRaw, mode: 'insensitive' },
              },
            });
            if (existingInventory) {
              batchAlreadyExists = true;
            }
          }

          // Case 3A: Exact duplicate (same medicine name AND same batch number)
          if (batchAlreadyExists) {
            results.duplicateCount++;
            results.duplicates.push({
              row: rowNum,
              name: rawName,
              batch_number: batchRaw,
              reason: `Duplicate skipped: Medicine "${rawName}" with batch "${batchRaw}" already exists in inventory.`,
            });
            continue;
          }

          // Case 3B: Product exists, row contains a NEW batch number
          await prisma.inventory.create({
            data: {
              product_id: existingProduct.id,
              location: 'STORE',
              batch_number: batchRaw,
              expiry_date: parsedExpiry,
              quantity: qtyParsed,
            },
          });
          processedBatches.add(batchKey);

          // If unit or sku was missing on existing product, update them
          if ((!existingProduct.unit && effectiveUnit) || (!existingProduct.sku && finalSku)) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                unit: existingProduct.unit || effectiveUnit,
                sku: existingProduct.sku || finalSku,
              },
            });
          }

          results.updatedCount++;
          results.successCount++;
          results.updated.push({
            id: existingProduct.id,
            name: existingProduct.name,
            batch_number: batchRaw,
          });
          continue;
        }

        // ── 4. Handle Case: Completely New Product ──
        const created = await prisma.product.create({
          data: {
            name: rawName,
            name_am: item.name_am || item.Name_Amharic || null,
            generic_name: item.generic_name || item.Generic_Name || null,
            category_id: categoryId,
            product_type: productType,
            dosage_form: effectiveDosageForm,
            strength: effectiveStrength,
            brand: item.brand || item.Brand || null,
            manufacturer: item.manufacturer || item.Manufacturer || null,
            unit_price: unitPrice,
            reorder_level: reorderLevel,
            requires_prescription: requiresRx,
            barcode: finalBarcode,
            sku: finalSku,
            unit: effectiveUnit,
            description: item.description || item.Description || null,
          },
        });

        // Register in-memory so subsequent rows in same CSV reuse this product
        processedProducts.set(nameLookupKey, created);
        processedProducts.set(compositeKey, created);
        if (created.barcode) {
          processedProducts.set(`barcode_${created.barcode.toLowerCase()}`, created);
        }

        const batchKey = `${created.id}__${batchRaw.toLowerCase()}`;

        await prisma.inventory.create({
          data: {
            product_id: created.id,
            location: 'STORE',
            batch_number: batchRaw,
            expiry_date: parsedExpiry,
            quantity: qtyParsed,
          },
        });
        processedBatches.add(batchKey);

        results.createdCount++;
        results.successCount++;
        results.created.push({ id: created.id, name: created.name, batch_number: batchRaw });
      } catch (err) {
        results.failedCount++;
        results.errors.push({ row: rowNum, error: err.message });
      }
    }

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'BULK_IMPORT',
        entity_type: 'PRODUCT',
        entity_id: results.created[0]?.id || results.updated[0]?.id || null,
        details: {
          total: results.total,
          successCount: results.successCount,
          createdCount: results.createdCount,
          updatedCount: results.updatedCount,
          duplicateCount: results.duplicateCount,
          failedCount: results.failedCount,
        },
      },
    });

    res.json({
      success: true,
      data: results,
      message: `Bulk import completed: ${results.createdCount} created, ${results.updatedCount} new batches added, ${results.duplicateCount} duplicates prevented.`,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/products/cleanup-duplicates
// Merges duplicate products with identical names into a single primary product
const cleanupDuplicateProducts = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: true,
        _count: {
          select: {
            inventory: true,
            sale_items: true,
            prescription_items: true,
            inventory_transfers: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Group products by normalized name and product_type
    const groups = new Map();
    for (const p of products) {
      const key = `${p.name.trim().toLowerCase()}__${p.product_type}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(p);
    }

    let cleanedGroupsCount = 0;
    let removedDuplicatesCount = 0;

    for (const [key, group] of groups.entries()) {
      if (group.length <= 1) continue;

      cleanedGroupsCount++;

      // Pick primary product: prefer the one with most sales/inventory, or oldest
      group.sort((a, b) => {
        const scoreA = (a._count.sale_items * 10) + (a._count.prescription_items * 10) + a._count.inventory;
        const scoreB = (b._count.sale_items * 10) + (b._count.prescription_items * 10) + b._count.inventory;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const primary = group[0];
      const duplicates = group.slice(1);

      for (const dup of duplicates) {
        // 1. Move or merge inventory
        for (const inv of dup.inventory) {
          const existingInvOnPrimary = await prisma.inventory.findFirst({
            where: {
              product_id: primary.id,
              location: inv.location,
              batch_number: inv.batch_number ? { equals: inv.batch_number, mode: 'insensitive' } : null,
            },
          });

          if (existingInvOnPrimary) {
            // Merge quantity
            await prisma.inventory.update({
              where: { id: existingInvOnPrimary.id },
              data: { quantity: { increment: inv.quantity } },
            });
            await prisma.inventory.delete({ where: { id: inv.id } });
          } else {
            // Re-point inventory to primary
            await prisma.inventory.update({
              where: { id: inv.id },
              data: { product_id: primary.id },
            });
          }
        }

        // 2. Re-point transfers
        await prisma.inventoryTransfer.updateMany({
          where: { product_id: dup.id },
          data: { product_id: primary.id },
        });

        // 3. Re-point sale items
        await prisma.saleItem.updateMany({
          where: { product_id: dup.id },
          data: { product_id: primary.id },
        });

        // 4. Re-point prescription items
        await prisma.prescriptionItem.updateMany({
          where: { product_id: dup.id },
          data: { product_id: primary.id },
        });

        // 5. Delete duplicate product
        await prisma.product.delete({ where: { id: dup.id } });
        removedDuplicatesCount++;
      }
    }

    if (removedDuplicatesCount > 0) {
      await prisma.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'CLEANUP_DUPLICATES',
          entity_type: 'PRODUCT',
          entity_id: null,
          details: {
            cleanedGroupsCount,
            removedDuplicatesCount,
          },
        },
      });
    }

    res.json({
      success: true,
      message: `Cleaned up ${removedDuplicatesCount} duplicate products across ${cleanedGroupsCount} groups.`,
      data: {
        cleanedGroupsCount,
        removedDuplicatesCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  searchProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStock,
  getExpiring,
  getImportTemplate,
  bulkUploadProducts,
  cleanupDuplicateProducts,
};
