const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');

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
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = {};
    if (sort) orderBy[sort] = order === 'desc' ? 'desc' : 'asc';
    else orderBy.created_at = 'desc';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit, orderBy,
        include: { category: true },
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
      reorder_level, requires_prescription, barcode, description,
    } = req.body;

    if (!name || !product_type || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Name, product type, and unit price are required' },
      });
    }

    const product = await prisma.product.create({
      data: {
        name, name_am, generic_name, category_id, product_type,
        dosage_form, strength, brand, manufacturer,
        unit_price: parseFloat(unit_price),
        reorder_level: reorder_level || 10,
        requires_prescription: requires_prescription || false,
        barcode, description,
      },
      include: { category: true },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'CREATE', entity_type: 'PRODUCT',
        entity_id: product.id, details: { name: product.name, product_type },
      },
    });

    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.unit_price !== undefined) {
      updateData.unit_price = parseFloat(updateData.unit_price);
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'UPDATE', entity_type: 'PRODUCT',
        entity_id: product.id, details: { updated_fields: Object.keys(updateData) },
      },
    });

    res.json({ success: true, data: product, message: 'Product updated successfully' });
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
    'Requires_Prescription',
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
      'true',
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
      'false',
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
      'false',
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
      failedCount: 0,
      errors: [],
      created: [],
    };

    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      const rowNum = i + 1;

      if (!item.name || !item.name.trim()) {
        results.failedCount++;
        results.errors.push({ row: rowNum, error: 'Product name is required' });
        continue;
      }

      const rawType = (item.product_type || item.Product_Type || 'MEDICINE').toUpperCase().trim();
      const productType = rawType === 'COSMETIC' ? 'COSMETIC' : 'MEDICINE';

      const unitPrice = parseFloat(item.unit_price || item.Unit_Price_ETB);
      if (isNaN(unitPrice) || unitPrice < 0) {
        results.failedCount++;
        results.errors.push({ row: rowNum, error: `Invalid unit price: ${item.unit_price || item.Unit_Price_ETB}` });
        continue;
      }

      const catName = (item.category || item.Category || '').toLowerCase().trim();
      let categoryId = categoryMap.get(catName);

      if (!categoryId) {
        const fallbackCat = categories.find((c) => c.type === productType);
        categoryId = fallbackCat ? fallbackCat.id : null;
      }

      const reorderLevel = parseInt(item.reorder_level || item.Reorder_Level) || 10;
      const requiresRx = String(item.requires_prescription || item.Requires_Prescription).toLowerCase() === 'true';

      try {
        const created = await prisma.product.create({
          data: {
            name: (item.name || item.Name).trim(),
            name_am: item.name_am || item.Name_Amharic || null,
            generic_name: item.generic_name || item.Generic_Name || null,
            category_id: categoryId,
            product_type: productType,
            dosage_form: item.dosage_form || item.Dosage_Form || null,
            strength: item.strength || item.Strength || null,
            brand: item.brand || item.Brand || null,
            manufacturer: item.manufacturer || item.Manufacturer || null,
            unit_price: unitPrice,
            reorder_level: reorderLevel,
            requires_prescription: requiresRx,
            barcode: item.barcode || item.Barcode || null,
            description: item.description || item.Description || null,
          },
        });

        results.successCount++;
        results.created.push({ id: created.id, name: created.name });
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
        entity_id: results.created[0]?.id || null,
        details: {
          total: results.total,
          successCount: results.successCount,
          failedCount: results.failedCount,
        },
      },
    });

    res.json({
      success: true,
      data: results,
      message: `Successfully imported ${results.successCount} of ${results.total} products.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts, searchProducts, getProduct, createProduct,
  updateProduct, deleteProduct, getLowStock, getExpiring,
  getImportTemplate, bulkUploadProducts,
};
