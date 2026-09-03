const prisma = require('../config/database');

// GET /api/v1/payment-methods
const getPaymentMethods = async (req, res, next) => {
  try {
    const { active_only } = req.query;
    const where = {};
    if (active_only === 'true') where.is_active = true;

    const methods = await prisma.paymentMethod.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });

    res.json({ success: true, data: methods });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/payment-methods
const createPaymentMethod = async (req, res, next) => {
  try {
    const { name, name_am, code, sort_order } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Name and code are required' },
      });
    }

    const method = await prisma.paymentMethod.create({
      data: { name, name_am, code: code.toUpperCase(), sort_order: sort_order || 0 },
    });

    res.status(201).json({ success: true, data: method, message: 'Payment method created' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/payment-methods/:id
const updatePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const method = await prisma.paymentMethod.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: method, message: 'Payment method updated' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/payment-methods/:id
const deletePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;

    const paymentCount = await prisma.payment.count({ where: { payment_method_id: id } });
    if (paymentCount > 0) {
      // Soft deactivate instead of hard delete
      await prisma.paymentMethod.update({
        where: { id },
        data: { is_active: false },
      });
      return res.json({ success: true, message: 'Payment method deactivated (has existing transactions)' });
    }

    await prisma.paymentMethod.delete({ where: { id } });
    res.json({ success: true, message: 'Payment method deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod };
