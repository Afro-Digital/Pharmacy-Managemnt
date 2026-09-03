const prisma = require('../config/database');
const { PAGINATION } = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');

// Generate sale number: SL-YYYYMMDD-XXXX
const generateSaleNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SL-${date}-${random}`;
};

// GET /api/v1/sales
const getSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;
    const { search, sale_type, status, from, to } = req.query;

    const where = {};
    if (sale_type) where.sale_type = sale_type;
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to + 'T23:59:59.999Z');
    }
    if (search) {
      where.OR = [
        { sale_number: { contains: search, mode: 'insensitive' } },
        { patient: { full_name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Role-based filtering:
    // Cashier can see all PENDING_PAYMENT orders in store queue, but past sales restricted to own
    if (req.user.role === 'CASHIER') {
      if (status === 'PENDING_PAYMENT') {
        where.status = 'PENDING_PAYMENT';
      } else if (!status) {
        where.OR = [
          { status: 'PENDING_PAYMENT' },
          { cashier_id: req.user.id },
        ];
      } else {
        where.cashier_id = req.user.id;
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where, skip, take: limit,
        include: {
          pharmacist: { select: { full_name: true, username: true } },
          cashier: { select: { full_name: true, username: true } },
          patient: { select: { full_name: true, phone: true } },
          items: { include: { product: { select: { name: true, name_am: true, generic_name: true, brand: true, unit_price: true } } } },
          payments: { include: { payment_method: true } },
          prescription: { select: { prescription_no: true } },
          _count: { select: { items: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({
      success: true,
      data: sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/sales/:id
const getSale = async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        pharmacist: { select: { full_name: true, username: true } },
        cashier: { select: { full_name: true, username: true } },
        patient: true,
        prescription: { include: { items: { include: { product: true } } } },
        items: { include: { product: true } },
        payments: { include: { payment_method: true } },
      },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sale not found' },
      });
    }

    res.json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/sales (Pharmacist or Admin approves product selection)
const createSale = async (req, res, next) => {
  try {
    const {
      items, payments, prescription_id, patient_id,
      discount_amount, sale_type, notes,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'At least one product item is required' },
      });
    }

    const hasImmediatePayments = payments && Array.isArray(payments) && payments.length > 0;
    const initialStatus = hasImmediatePayments ? 'COMPLETED' : 'PENDING_PAYMENT';

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;

      // Validate and reserve/decrement dispensary stock
      for (const item of items) {
        const inv = await tx.inventory.findFirst({
          where: {
            product_id: item.product_id,
            location: 'DISPENSARY',
            batch_number: item.batch_number || undefined,
            quantity: { gte: item.quantity },
          },
        });

        if (!inv) {
          const product = await tx.product.findUnique({ where: { id: item.product_id } });
          throw new AppError(
            `Insufficient dispensary stock for ${product?.name || item.product_id}`,
            400, 'INSUFFICIENT_STOCK'
          );
        }

        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: inv.quantity - item.quantity },
        });

        item.batch_number = inv.batch_number;
        const itemTotal = item.quantity * item.unit_price - (item.discount || 0);
        item.total_price = itemTotal;
        subtotal += itemTotal;
      }

      const discount = parseFloat(discount_amount) || 0;
      const total_amount = Math.max(0, subtotal - discount);

      // If immediate payments are provided, validate amount
      if (hasImmediatePayments) {
        const paymentSum = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        if (paymentSum < total_amount - 0.01) {
          throw new AppError(
            `Payment total (${paymentSum.toFixed(2)}) is less than sale total (${total_amount.toFixed(2)})`,
            400, 'INSUFFICIENT_PAYMENT'
          );
        }
      }

      // Create sale record
      const sale = await tx.sale.create({
        data: {
          sale_number: generateSaleNumber(),
          prescription_id,
          patient_id,
          pharmacist_id: req.user.role === 'PHARMACIST' || req.user.role === 'ADMIN' ? req.user.id : null,
          cashier_id: hasImmediatePayments ? req.user.id : null,
          subtotal,
          discount_amount: discount,
          total_amount,
          sale_type: sale_type || (prescription_id ? 'PRESCRIPTION' : 'WALK_IN'),
          status: initialStatus,
          notes,
          items: {
            create: items.map((i) => ({
              product_id: i.product_id,
              batch_number: i.batch_number,
              quantity: i.quantity,
              unit_price: i.unit_price,
              discount: i.discount || 0,
              total_price: i.total_price,
            })),
          },
          payments: hasImmediatePayments
            ? {
                create: payments.map((p) => ({
                  payment_method_id: p.payment_method_id,
                  amount: parseFloat(p.amount),
                  reference_number: p.reference_number,
                })),
              }
            : undefined,
        },
        include: {
          items: { include: { product: true } },
          payments: { include: { payment_method: true } },
          pharmacist: { select: { full_name: true } },
          cashier: { select: { full_name: true } },
          patient: true,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: initialStatus === 'PENDING_PAYMENT' ? 'APPROVE_SALE' : 'CREATE_SALE',
          entity_type: 'SALE',
          entity_id: sale.id,
          details: {
            sale_number: sale.sale_number,
            total_amount,
            status: initialStatus,
            pharmacist: req.user.username,
          },
        },
      });

      return sale;
    });

    const message = result.status === 'PENDING_PAYMENT'
      ? 'Products approved by Pharmacist and sent to Cashier for payment'
      : 'Sale completed successfully';

    res.status(201).json({ success: true, data: result, message });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/sales/:id/pay (Cashier confirms payment)
const confirmPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payments } = req.body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'At least one payment method and amount is required' },
      });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sale not found' },
      });
    }

    if (sale.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Sale is already in ${sale.status} status` },
      });
    }

    const totalDue = parseFloat(sale.total_amount);
    const paymentSum = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    if (paymentSum < totalDue - 0.01) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PAYMENT',
          message: `Payment total (${paymentSum.toFixed(2)} ETB) is less than amount due (${totalDue.toFixed(2)} ETB)`,
        },
      });
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Create payments
      for (const p of payments) {
        await tx.payment.create({
          data: {
            sale_id: id,
            payment_method_id: p.payment_method_id,
            amount: parseFloat(p.amount),
            reference_number: p.reference_number || null,
          },
        });
      }

      // Update sale status to COMPLETED and attach cashier
      const completed = await tx.sale.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          cashier_id: req.user.id,
        },
        include: {
          items: { include: { product: true } },
          payments: { include: { payment_method: true } },
          pharmacist: { select: { full_name: true } },
          cashier: { select: { full_name: true } },
          patient: true,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'PAYMENT_CONFIRMED',
          entity_type: 'SALE',
          entity_id: id,
          details: {
            sale_number: completed.sale_number,
            paid_amount: paymentSum,
            cashier: req.user.username,
          },
        },
      });

      return completed;
    });

    res.json({
      success: true,
      data: updatedSale,
      message: 'Payment confirmed and sale completed successfully',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/sales/:id/cancel (Cancel pending sale and restore reserved stock)
const cancelPendingSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sale not found' },
      });
    }

    if (sale.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only PENDING_PAYMENT sales can be cancelled' },
      });
    }

    await prisma.$transaction(async (tx) => {
      // Restock items to dispensary
      for (const item of sale.items) {
        const inv = await tx.inventory.findFirst({
          where: {
            product_id: item.product_id,
            location: 'DISPENSARY',
            batch_number: item.batch_number,
          },
        });

        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: inv.quantity + item.quantity },
          });
        } else {
          await tx.inventory.create({
            data: {
              product_id: item.product_id,
              location: 'DISPENSARY',
              batch_number: item.batch_number,
              quantity: item.quantity,
            },
          });
        }
      }

      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'CANCEL_SALE',
          entity_type: 'SALE',
          entity_id: id,
          details: { reason: reason || 'Cancelled prior to payment' },
        },
      });
    });

    res.json({ success: true, message: 'Sale order cancelled and inventory restored' });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/sales/:id/refund
const refundSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items: refundItems, reason } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sale not found' },
      });
    }

    if (sale.status === 'REFUNDED') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_REFUNDED', message: 'This sale has already been fully refunded' },
      });
    }

    await prisma.$transaction(async (tx) => {
      const itemsToRefund = refundItems || sale.items;

      // Restock items to dispensary
      for (const item of itemsToRefund) {
        const saleItem = sale.items.find((si) => si.product_id === item.product_id);
        if (!saleItem) continue;

        const refundQty = item.quantity || saleItem.quantity;

        const inv = await tx.inventory.findFirst({
          where: {
            product_id: item.product_id,
            location: 'DISPENSARY',
            batch_number: saleItem.batch_number,
          },
        });

        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: inv.quantity + refundQty },
          });
        } else {
          await tx.inventory.create({
            data: {
              product_id: item.product_id,
              location: 'DISPENSARY',
              batch_number: saleItem.batch_number,
              quantity: refundQty,
            },
          });
        }
      }

      const isPartial = refundItems && refundItems.length < sale.items.length;

      await tx.sale.update({
        where: { id },
        data: { status: isPartial ? 'PARTIAL_REFUND' : 'REFUNDED' },
      });

      await tx.auditLog.create({
        data: {
          user_id: req.user.id, action: 'REFUND', entity_type: 'SALE',
          entity_id: id, details: { reason, type: isPartial ? 'partial' : 'full' },
        },
      });
    });

    const updatedSale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: { include: { payment_method: true } },
      },
    });

    res.json({ success: true, data: updatedSale, message: 'Refund processed successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/sales/:id/receipt
const getReceipt = async (req, res, next) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        pharmacist: { select: { full_name: true } },
        cashier: { select: { full_name: true } },
        patient: { select: { full_name: true, phone: true } },
        items: { include: { product: { select: { name: true, name_am: true } } } },
        payments: { include: { payment_method: true } },
      },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sale not found' },
      });
    }

    const settings = await prisma.storeSettings.findFirst();

    res.json({
      success: true,
      data: {
        store: {
          name: settings?.pharmacy_name || 'TilexPharmacy',
          name_am: settings?.pharmacy_name_am,
          address: settings?.address,
          phone: settings?.phone,
          email: settings?.email,
          logo_url: settings?.logo_url,
        },
        sale,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSales, getSale, createSale, confirmPayment,
  cancelPendingSale, refundSale, getReceipt,
};
