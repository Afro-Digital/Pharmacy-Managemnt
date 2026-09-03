const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');

// GET /api/v1/inventory
const getInventory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const { location, product_type, category_id, search, expiry_status } = req.query;

    const where = {};
    if (location) where.location = location;
    if (search) {
      where.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    if (product_type) {
      where.product = { ...where.product, product_type };
    }
    if (category_id) {
      where.product = { ...where.product, category_id };
    }

    // Expiry filters
    if (expiry_status === 'expired') {
      where.expiry_date = { lt: new Date() };
    } else if (expiry_status === 'expiring_soon') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      where.expiry_date = { gte: new Date(), lte: futureDate };
    }

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where, skip, take: limit,
        include: {
          product: { include: { category: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.inventory.count({ where }),
    ]);

    res.json({
      success: true,
      data: inventory,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/inventory (Add stock to Store)
const addStock = async (req, res, next) => {
  try {
    const {
      product_id, batch_number, expiry_date, quantity,
      shelf_location, supplier_name, notes,
    } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Product ID and quantity are required' },
      });
    }

    // Check if batch exists at Store
    const existing = await prisma.inventory.findUnique({
      where: {
        product_id_location_batch_number: {
          product_id, location: 'STORE', batch_number: batch_number || '',
        },
      },
    });

    let inventory;
    if (existing) {
      inventory = await prisma.inventory.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + parseInt(quantity) },
        include: { product: true },
      });
    } else {
      inventory = await prisma.inventory.create({
        data: {
          product_id,
          location: 'STORE',
          batch_number: batch_number || null,
          expiry_date: expiry_date ? new Date(expiry_date) : null,
          quantity: parseInt(quantity),
          shelf_location,
          supplier_name,
          notes,
        },
        include: { product: true },
      });
    }

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'ADD_STOCK', entity_type: 'INVENTORY',
        entity_id: inventory.id, details: { product_id, quantity, batch_number, location: 'STORE' },
      },
    });

    res.status(201).json({ success: true, data: inventory, message: 'Stock added successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/inventory/:id (Adjust stock)
const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, reason } = req.body;

    if (quantity === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'New quantity and reason are required for stock adjustment' },
      });
    }

    const current = await prisma.inventory.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inventory record not found' },
      });
    }

    const inventory = await prisma.inventory.update({
      where: { id },
      data: { quantity: parseInt(quantity) },
      include: { product: true },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'ADJUST_STOCK', entity_type: 'INVENTORY',
        entity_id: id,
        details: {
          previous_quantity: current.quantity,
          new_quantity: parseInt(quantity),
          difference: parseInt(quantity) - current.quantity,
          reason,
        },
      },
    });

    res.json({ success: true, data: inventory, message: 'Stock adjusted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/inventory/transfer
const transferStock = async (req, res, next) => {
  try {
    const { product_id, batch_number, from_location, to_location, quantity, notes } = req.body;

    if (!product_id || !quantity || !from_location || !to_location) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Product, quantity, and locations are required' },
      });
    }

    if (from_location === to_location) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Source and destination cannot be the same' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check source inventory
      const sourceInv = await tx.inventory.findUnique({
        where: {
          product_id_location_batch_number: {
            product_id, location: from_location, batch_number: batch_number || '',
          },
        },
      });

      if (!sourceInv || sourceInv.quantity < parseInt(quantity)) {
        throw new AppError(
          `Insufficient stock. Available: ${sourceInv?.quantity || 0}, Requested: ${quantity}`,
          400, 'INSUFFICIENT_STOCK'
        );
      }

      // Decrement source
      await tx.inventory.update({
        where: { id: sourceInv.id },
        data: { quantity: sourceInv.quantity - parseInt(quantity) },
      });

      // Increment or create destination
      const destInv = await tx.inventory.findUnique({
        where: {
          product_id_location_batch_number: {
            product_id, location: to_location, batch_number: batch_number || '',
          },
        },
      });

      if (destInv) {
        await tx.inventory.update({
          where: { id: destInv.id },
          data: { quantity: destInv.quantity + parseInt(quantity) },
        });
      } else {
        await tx.inventory.create({
          data: {
            product_id, location: to_location,
            batch_number: batch_number || null,
            quantity: parseInt(quantity),
            expiry_date: sourceInv.expiry_date,
            shelf_location: sourceInv.shelf_location,
          },
        });
      }

      // Create transfer record
      const transfer = await tx.inventoryTransfer.create({
        data: {
          product_id, batch_number: batch_number || null,
          from_location, to_location,
          quantity: parseInt(quantity),
          transferred_by: req.user.id,
          notes,
        },
        include: { product: true, user: { select: { full_name: true } } },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id, action: 'TRANSFER', entity_type: 'INVENTORY',
          entity_id: transfer.id,
          details: { from: from_location, to: to_location, quantity: parseInt(quantity), product_id },
        },
      });

      return transfer;
    });

    res.status(201).json({ success: true, data: result, message: 'Stock transferred successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/inventory/transfers
const getTransfers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const [transfers, total] = await Promise.all([
      prisma.inventoryTransfer.findMany({
        skip, take: limit,
        include: {
          product: true,
          user: { select: { full_name: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.inventoryTransfer.count(),
    ]);

    res.json({
      success: true,
      data: transfers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/inventory/store
const getStoreInventory = async (req, res, next) => {
  req.query.location = 'STORE';
  return getInventory(req, res, next);
};

// GET /api/v1/inventory/dispensary
const getDispensaryInventory = async (req, res, next) => {
  req.query.location = 'DISPENSARY';
  return getInventory(req, res, next);
};

module.exports = {
  getInventory, addStock, adjustStock, transferStock,
  getTransfers, getStoreInventory, getDispensaryInventory,
};
