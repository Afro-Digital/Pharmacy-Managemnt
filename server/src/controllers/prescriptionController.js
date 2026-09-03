const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');

// Generate prescription number: RX-YYYYMMDD-XXXX
const generatePrescriptionNo = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `RX-${date}-${random}`;
};

// GET /api/v1/prescriptions
const getPrescriptions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const { search, status, from, to } = req.query;

    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to + 'T23:59:59.999Z');
    }
    if (search) {
      where.OR = [
        { prescription_no: { contains: search, mode: 'insensitive' } },
        { patient: { full_name: { contains: search, mode: 'insensitive' } } },
        { patient: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where, skip, take: limit,
        include: {
          patient: true,
          dispenser: { select: { full_name: true } },
          items: { include: { product: true } },
          _count: { select: { sales: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.prescription.count({ where }),
    ]);

    res.json({
      success: true,
      data: prescriptions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/prescriptions/:id
const getPrescription = async (req, res, next) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: req.params.id },
      include: {
        patient: true,
        dispenser: { select: { full_name: true, username: true } },
        items: { include: { product: { include: { category: true } } } },
        sales: {
          include: { items: true, payments: { include: { payment_method: true } } },
        },
      },
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Prescription not found' },
      });
    }

    res.json({ success: true, data: prescription });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/prescriptions
const createPrescription = async (req, res, next) => {
  try {
    const { patient_id, prescribed_by, items, notes } = req.body;

    if (!patient_id || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Patient and at least one item are required' },
      });
    }

    const prescription = await prisma.prescription.create({
      data: {
        prescription_no: generatePrescriptionNo(),
        patient_id,
        prescribed_by,
        notes,
        items: {
          create: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            dosage: item.dosage,
            duration: item.duration,
            instructions: item.instructions,
          })),
        },
      },
      include: {
        patient: true,
        items: { include: { product: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'CREATE', entity_type: 'PRESCRIPTION',
        entity_id: prescription.id, details: { prescription_no: prescription.prescription_no, patient_id },
      },
    });

    res.status(201).json({ success: true, data: prescription, message: 'Prescription created successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/prescriptions/:id
const updatePrescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { prescribed_by, notes, items } = req.body;

    const existing = await prisma.prescription.findUnique({ where: { id } });
    if (!existing || existing.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only PENDING prescriptions can be edited' },
      });
    }

    const updateData = {};
    if (prescribed_by !== undefined) updateData.prescribed_by = prescribed_by;
    if (notes !== undefined) updateData.notes = notes;

    // If items are provided, replace them
    if (items) {
      await prisma.prescriptionItem.deleteMany({ where: { prescription_id: id } });
      updateData.items = {
        create: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          dosage: item.dosage,
          duration: item.duration,
          instructions: item.instructions,
        })),
      };
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: updateData,
      include: { patient: true, items: { include: { product: true } } },
    });

    res.json({ success: true, data: prescription, message: 'Prescription updated successfully' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/prescriptions/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'DISPENSED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      });
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: { status },
      include: { patient: true, items: { include: { product: true } } },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id, action: 'STATUS_CHANGE', entity_type: 'PRESCRIPTION',
        entity_id: id, details: { new_status: status },
      },
    });

    res.json({ success: true, data: prescription, message: `Prescription status updated to ${status}` });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/prescriptions/:id/dispense
const dispensePrescription = async (req, res, next) => {
  try {
    const { id } = req.params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Prescription not found' },
      });
    }

    if (prescription.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only PENDING prescriptions can be dispensed' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check and decrement dispensary inventory for each item
      for (const item of prescription.items) {
        const qtyToDispense = item.quantity - (item.dispensed_qty || 0);
        if (qtyToDispense <= 0) continue;

        const invRecords = await tx.inventory.findMany({
          where: {
            product_id: item.product_id,
            location: 'DISPENSARY',
            quantity: { gt: 0 },
          },
          orderBy: { expiry_date: 'asc' }, // FEFO: First Expiry First Out
        });

        let remaining = qtyToDispense;
        for (const inv of invRecords) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, inv.quantity);
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: inv.quantity - deduct },
          });
          remaining -= deduct;
        }

        if (remaining > 0) {
          throw new AppError(
            `Insufficient dispensary stock for ${item.product.name}. Short by ${remaining} units.`,
            400, 'INSUFFICIENT_STOCK'
          );
        }

        // Update dispensed_qty
        await tx.prescriptionItem.update({
          where: { id: item.id },
          data: { dispensed_qty: item.quantity },
        });
      }

      // Update prescription status
      const updated = await tx.prescription.update({
        where: { id },
        data: {
          status: 'DISPENSED',
          dispensed_by: req.user.id,
        },
        include: { patient: true, items: { include: { product: true } }, dispenser: { select: { full_name: true } } },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id, action: 'DISPENSE', entity_type: 'PRESCRIPTION',
          entity_id: id, details: { prescription_no: prescription.prescription_no },
        },
      });

      return updated;
    });

    res.json({ success: true, data: result, message: 'Prescription dispensed successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPrescriptions, getPrescription, createPrescription,
  updatePrescription, updateStatus, dispensePrescription,
};
