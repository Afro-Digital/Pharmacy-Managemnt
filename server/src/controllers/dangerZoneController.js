const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

/**
 * Validates admin password and typed confirmation phrase.
 */
const verifyAdminAuthorization = async (userId, password, requiredPhrase, providedPhrase) => {
  if (requiredPhrase) {
    if (!providedPhrase || providedPhrase.trim().toUpperCase() !== requiredPhrase.trim().toUpperCase()) {
      throw new AppError(
        `Confirmation text mismatch. Please type "${requiredPhrase}" exactly to confirm.`,
        400,
        'CONFIRMATION_MISMATCH'
      );
    }
  }

  if (!password) {
    throw new AppError('Administrator password is required to authorize this action.', 400, 'PASSWORD_REQUIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'ADMIN') {
    throw new AppError('Unauthorized: Only administrators can execute Danger Zone actions.', 403, 'FORBIDDEN');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Incorrect administrator password.', 401, 'INVALID_PASSWORD');
  }

  return user;
};

// ─── GET /api/v1/danger-zone/stats ──────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [
      productsCount,
      inventoryCount,
      salesCount,
      prescriptionsCount,
      shiftsCount,
      reconciliationsCount,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.inventory.count(),
      prisma.sale.count(),
      prisma.prescription.count(),
      prisma.workShift.count(),
      prisma.reconciliation.count(),
    ]);

    res.json({
      success: true,
      data: {
        productsCount,
        inventoryCount,
        salesCount,
        prescriptionsCount,
        shiftsCount,
        reconciliationsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/danger-zone/delete-all-products ───────────────────────────
const deleteAllProducts = async (req, res, next) => {
  try {
    const { password, confirmPhrase } = req.body;
    await verifyAdminAuthorization(req.user.id, password, 'DELETE ALL PRODUCTS', confirmPhrase);

    const result = await prisma.$transaction(async (tx) => {
      const transfers = await tx.inventoryTransfer.deleteMany({});
      const inventory = await tx.inventory.deleteMany({});
      const rxItems = await tx.prescriptionItem.deleteMany({});
      const saleItems = await tx.saleItem.deleteMany({});
      const products = await tx.product.deleteMany({});

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'DANGER_DELETE_ALL_PRODUCTS',
          entity_type: 'PRODUCT',
          entity_id: null,
          details: {
            productsDeleted: products.count,
            inventoryDeleted: inventory.count,
            transfersDeleted: transfers.count,
            saleItemsDeleted: saleItems.count,
            rxItemsDeleted: rxItems.count,
          },
          ip_address: req.ip,
        },
      });

      return {
        productsDeleted: products.count,
        inventoryDeleted: inventory.count,
      };
    });

    res.json({
      success: true,
      message: `Successfully deleted all ${result.productsDeleted} products and ${result.inventoryDeleted} inventory records.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/danger-zone/clear-all-sales ───────────────────────────────
const clearAllSales = async (req, res, next) => {
  try {
    const { password, confirmPhrase } = req.body;
    await verifyAdminAuthorization(req.user.id, password, 'CLEAR ALL SALES', confirmPhrase);

    const result = await prisma.$transaction(async (tx) => {
      await tx.reconciliationEntry.deleteMany({});
      const recons = await tx.reconciliation.deleteMany({});
      const shifts = await tx.workShift.deleteMany({});
      const payments = await tx.payment.deleteMany({});
      const saleItems = await tx.saleItem.deleteMany({});
      const sales = await tx.sale.deleteMany({});

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'DANGER_CLEAR_ALL_SALES',
          entity_type: 'SALE',
          entity_id: null,
          details: {
            salesDeleted: sales.count,
            paymentsDeleted: payments.count,
            shiftsDeleted: shifts.count,
            reconciliationsDeleted: recons.count,
          },
          ip_address: req.ip,
        },
      });

      return {
        salesDeleted: sales.count,
        paymentsDeleted: payments.count,
        shiftsDeleted: shifts.count,
        reconciliationsDeleted: recons.count,
      };
    });

    res.json({
      success: true,
      message: `Successfully cleared ${result.salesDeleted} sales, ${result.paymentsDeleted} payments, and ${result.shiftsDeleted} shifts.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/danger-zone/reset-inventory ──────────────────────────────
const resetInventoryQuantities = async (req, res, next) => {
  try {
    const { password, confirmPhrase } = req.body;
    await verifyAdminAuthorization(req.user.id, password, 'RESET STOCK TO ZERO', confirmPhrase);

    const updated = await prisma.inventory.updateMany({
      data: { quantity: 0 },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'DANGER_RESET_INVENTORY',
        entity_type: 'INVENTORY',
        entity_id: null,
        details: { batchesZeroed: updated.count },
        ip_address: req.ip,
      },
    });

    res.json({
      success: true,
      message: `Successfully zeroed stock quantities across all ${updated.count} inventory batches.`,
      data: { batchesZeroed: updated.count },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/danger-zone/clear-prescriptions ───────────────────────────
const clearAllPrescriptions = async (req, res, next) => {
  try {
    const { password, confirmPhrase } = req.body;
    await verifyAdminAuthorization(req.user.id, password, 'CLEAR ALL PRESCRIPTIONS', confirmPhrase);

    const result = await prisma.$transaction(async (tx) => {
      await tx.prescriptionItem.deleteMany({});
      const rx = await tx.prescription.deleteMany({});
      const sessions = await tx.rxUploadSession.deleteMany({});

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'DANGER_CLEAR_PRESCRIPTIONS',
          entity_type: 'PRESCRIPTION',
          entity_id: null,
          details: {
            prescriptionsDeleted: rx.count,
            sessionsDeleted: sessions.count,
          },
          ip_address: req.ip,
        },
      });

      return {
        prescriptionsDeleted: rx.count,
        sessionsDeleted: sessions.count,
      };
    });

    res.json({
      success: true,
      message: `Successfully cleared all ${result.prescriptionsDeleted} prescriptions and upload sessions.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/danger-zone/factory-reset ─────────────────────────────────
const factoryReset = async (req, res, next) => {
  try {
    const { password, confirmPhrase } = req.body;
    await verifyAdminAuthorization(req.user.id, password, 'FACTORY RESET', confirmPhrase);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Reconciliations & Shifts
      await tx.reconciliationEntry.deleteMany({});
      const recons = await tx.reconciliation.deleteMany({});
      const shifts = await tx.workShift.deleteMany({});

      // 2. Sales & Payments
      const payments = await tx.payment.deleteMany({});
      const saleItems = await tx.saleItem.deleteMany({});
      const sales = await tx.sale.deleteMany({});

      // 3. Prescriptions
      await tx.prescriptionItem.deleteMany({});
      const rx = await tx.prescription.deleteMany({});
      await tx.rxUploadSession.deleteMany({});

      // 4. Inventory & Transfers
      const transfers = await tx.inventoryTransfer.deleteMany({});
      const inventory = await tx.inventory.deleteMany({});

      // 5. Products
      const products = await tx.product.deleteMany({});

      // 6. Notifications
      const notifications = await tx.notification.deleteMany({});

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'DANGER_FACTORY_RESET',
          entity_type: 'SYSTEM',
          entity_id: null,
          details: {
            products: products.count,
            inventory: inventory.count,
            sales: sales.count,
            prescriptions: rx.count,
            shifts: shifts.count,
          },
          ip_address: req.ip,
        },
      });

      return {
        productsDeleted: products.count,
        inventoryDeleted: inventory.count,
        salesDeleted: sales.count,
        prescriptionsDeleted: rx.count,
      };
    });

    res.json({
      success: true,
      message: 'Factory reset completed. All operational data cleared while preserving Admin and settings.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  deleteAllProducts,
  clearAllSales,
  resetInventoryQuantities,
  clearAllPrescriptions,
  factoryReset,
};
