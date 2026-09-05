const prisma = require('../config/database');

// GET /api/v1/notifications
const getNotifications = async (req, res, next) => {
  try {
    const userRole = req.user?.role || 'CASHIER';
    const notifications = [];

    // 1. Check Low Stock Items (for ADMIN and PHARMACIST)
    if (['ADMIN', 'PHARMACIST'].includes(userRole)) {
      const products = await prisma.product.findMany({
        where: { is_active: true },
        include: { inventory: true, category: true },
      });

      products.forEach((p) => {
        const totalQty = p.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
        if (totalQty <= p.reorder_level) {
          const isZero = totalQty === 0;
          notifications.push({
            id: `low-stock-${p.id}`,
            type: 'LOW_STOCK',
            category: 'INVENTORY',
            title: isZero ? `Out of Stock: ${p.name}` : `Low Stock: ${p.name}`,
            message: isZero
              ? `${p.name} is completely depleted. Reorder level is ${p.reorder_level} units.`
              : `${p.name} has only ${totalQty} units left (threshold: ${p.reorder_level}).`,
            severity: isZero ? 'error' : 'warning',
            link: '/inventory',
            timestamp: p.updated_at || new Date(),
            metadata: {
              productId: p.id,
              productName: p.name,
              totalQuantity: totalQty,
              reorderLevel: p.reorder_level,
            },
          });
        }
      });

      // 2. Check Expiring Inventory Batches (Within 60 days or already expired)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      const expiringBatches = await prisma.inventory.findMany({
        where: {
          expiry_date: {
            not: null,
            lte: futureDate,
          },
          quantity: { gt: 0 },
        },
        include: { product: true },
        orderBy: { expiry_date: 'asc' },
        take: 15,
      });

      const now = new Date();
      expiringBatches.forEach((batch) => {
        const isExpired = new Date(batch.expiry_date) <= now;
        const expiryFormatted = new Date(batch.expiry_date).toISOString().split('T')[0];
        notifications.push({
          id: `expiring-${batch.id}`,
          type: 'EXPIRING_SOON',
          category: 'INVENTORY',
          title: isExpired ? `Expired: ${batch.product.name}` : `Expiring Soon: ${batch.product.name}`,
          message: isExpired
            ? `Batch ${batch.batch_number || 'GEN'} expired on ${expiryFormatted} (${batch.quantity} units at ${batch.location}).`
            : `Batch ${batch.batch_number || 'GEN'} expires on ${expiryFormatted} (${batch.quantity} units remaining).`,
          severity: isExpired ? 'error' : 'warning',
          link: '/inventory',
          timestamp: batch.updated_at || batch.created_at,
          metadata: {
            inventoryId: batch.id,
            productId: batch.product_id,
            batchNumber: batch.batch_number,
            expiryDate: batch.expiry_date,
            quantity: batch.quantity,
          },
        });
      });
    }

    // 3. Pending Orders / Sales awaiting Cashier Payment (All roles, especially CASHIER & ADMIN)
    const pendingSales = await prisma.sale.findMany({
      where: { status: 'PENDING_PAYMENT' },
      include: {
        patient: true,
        pharmacist: { select: { full_name: true } },
        items: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    pendingSales.forEach((sale) => {
      notifications.push({
        id: `pending-sale-${sale.id}`,
        type: 'PENDING_ORDER',
        category: 'ORDERS',
        title: `Order #${sale.sale_number} Ready for Payment`,
        message: `${sale.patient?.full_name || 'Walk-in Customer'} • ${parseFloat(sale.total_amount).toFixed(2)} ETB approved by ${sale.pharmacist?.full_name || 'Pharmacist'}.`,
        severity: 'info',
        link: '/pos',
        timestamp: sale.created_at,
        metadata: {
          saleId: sale.id,
          saleNumber: sale.sale_number,
          totalAmount: sale.total_amount,
        },
      });
    });

    // 4. Pending Prescriptions (ADMIN, PHARMACIST)
    if (['ADMIN', 'PHARMACIST'].includes(userRole)) {
      const pendingPrescriptions = await prisma.prescription.findMany({
        where: { status: 'PENDING' },
        include: {
          patient: true,
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      pendingPrescriptions.forEach((rx) => {
        notifications.push({
          id: `pending-rx-${rx.id}`,
          type: 'PENDING_PRESCRIPTION',
          category: 'PRESCRIPTIONS',
          title: `New Rx: ${rx.prescription_no}`,
          message: `Prescription for ${rx.patient?.full_name || 'Patient'} submitted by Dr. ${rx.doctor_name || 'Unknown'}.`,
          severity: 'info',
          link: '/prescriptions',
          timestamp: rx.created_at,
          metadata: {
            prescriptionId: rx.id,
            prescriptionNo: rx.prescription_no,
          },
        });
      });
    }

    // Sort all notifications chronologically (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const counts = {
      total: notifications.length,
      inventory: notifications.filter((n) => n.category === 'INVENTORY').length,
      orders: notifications.filter((n) => n.category === 'ORDERS').length,
      prescriptions: notifications.filter((n) => n.category === 'PRESCRIPTIONS').length,
    };

    res.json({
      success: true,
      data: {
        notifications,
        counts,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
};
