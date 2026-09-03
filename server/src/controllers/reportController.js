const prisma = require('../config/database');

// GET /api/v1/reports/sales
const getSalesReport = async (req, res, next) => {
  try {
    const { from, to, group_by } = req.query;

    const where = { status: { not: 'REFUNDED' } };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to + 'T23:59:59.999Z');
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true } },
        payments: { include: { payment_method: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const total_revenue = sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
    const total_discount = sales.reduce((sum, s) => sum + parseFloat(s.discount_amount || 0), 0);
    const sales_count = sales.length;
    const average_sale = sales_count > 0 ? total_revenue / sales_count : 0;

    // Group by day/week/month
    const grouped = {};
    for (const sale of sales) {
      let key;
      const date = new Date(sale.created_at);
      if (group_by === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (group_by === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else {
        key = date.toISOString().slice(0, 10);
      }

      if (!grouped[key]) grouped[key] = { date: key, revenue: 0, count: 0 };
      grouped[key].revenue += parseFloat(sale.total_amount);
      grouped[key].count += 1;
    }

    // Top selling products
    const productSales = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        const name = item.product?.name || 'Unknown';
        if (!productSales[name]) productSales[name] = { name, quantity: 0, revenue: 0 };
        productSales[name].quantity += item.quantity;
        productSales[name].revenue += parseFloat(item.total_price);
      }
    }

    const top_products = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        total_revenue: parseFloat(total_revenue.toFixed(2)),
        total_discount: parseFloat(total_discount.toFixed(2)),
        sales_count,
        average_sale: parseFloat(average_sale.toFixed(2)),
        daily_breakdown: Object.values(grouped),
        top_products,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/inventory
const getInventoryReport = async (req, res, next) => {
  try {
    const inventory = await prisma.inventory.findMany({
      include: { product: { include: { category: true } } },
      orderBy: { product: { name: 'asc' } },
    });

    // Aggregate by product
    const productMap = {};
    for (const inv of inventory) {
      const pid = inv.product_id;
      if (!productMap[pid]) {
        productMap[pid] = {
          product: inv.product,
          store_qty: 0,
          dispensary_qty: 0,
          total_qty: 0,
          batches: [],
        };
      }
      if (inv.location === 'STORE') productMap[pid].store_qty += inv.quantity;
      else productMap[pid].dispensary_qty += inv.quantity;
      productMap[pid].total_qty += inv.quantity;
      productMap[pid].batches.push({
        batch_number: inv.batch_number,
        location: inv.location,
        quantity: inv.quantity,
        expiry_date: inv.expiry_date,
      });
    }

    const products = Object.values(productMap);
    const low_stock = products.filter((p) => p.total_qty <= p.product.reorder_level);
    const total_items = products.reduce((sum, p) => sum + p.total_qty, 0);

    res.json({
      success: true,
      data: {
        total_products: products.length,
        total_items,
        low_stock_count: low_stock.length,
        products,
        low_stock_items: low_stock,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/financial
const getFinancialReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const where = { status: { not: 'REFUNDED' } };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to + 'T23:59:59.999Z');
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { payments: { include: { payment_method: true } } },
    });

    const total_revenue = sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
    const total_discount = sales.reduce((sum, s) => sum + parseFloat(s.discount_amount || 0), 0);

    // Payment method distribution
    const paymentDist = {};
    for (const sale of sales) {
      for (const payment of sale.payments) {
        const method = payment.payment_method.name;
        if (!paymentDist[method]) paymentDist[method] = { method, amount: 0, count: 0 };
        paymentDist[method].amount += parseFloat(payment.amount);
        paymentDist[method].count += 1;
      }
    }

    res.json({
      success: true,
      data: {
        total_revenue: parseFloat(total_revenue.toFixed(2)),
        total_discount: parseFloat(total_discount.toFixed(2)),
        net_revenue: parseFloat((total_revenue - total_discount).toFixed(2)),
        transaction_count: sales.length,
        payment_distribution: Object.values(paymentDist),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/prescriptions
const getPrescriptionReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const where = {};
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to + 'T23:59:59.999Z');
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: { items: { include: { product: true } }, patient: true },
    });

    const statusBreakdown = {};
    const medicineCount = {};
    for (const rx of prescriptions) {
      statusBreakdown[rx.status] = (statusBreakdown[rx.status] || 0) + 1;
      for (const item of rx.items) {
        const name = item.product?.name || 'Unknown';
        if (!medicineCount[name]) medicineCount[name] = { name, count: 0, total_qty: 0 };
        medicineCount[name].count += 1;
        medicineCount[name].total_qty += item.quantity;
      }
    }

    const top_medicines = Object.values(medicineCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        total_prescriptions: prescriptions.length,
        status_breakdown: statusBreakdown,
        top_prescribed_medicines: top_medicines,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/expiring-products
const getExpiringReport = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const expired = await prisma.inventory.findMany({
      where: { expiry_date: { lt: new Date() }, quantity: { gt: 0 } },
      include: { product: { include: { category: true } } },
      orderBy: { expiry_date: 'asc' },
    });

    const expiringSoon = await prisma.inventory.findMany({
      where: { expiry_date: { gte: new Date(), lte: futureDate }, quantity: { gt: 0 } },
      include: { product: { include: { category: true } } },
      orderBy: { expiry_date: 'asc' },
    });

    res.json({
      success: true,
      data: {
        expired: { count: expired.length, items: expired },
        expiring_soon: { count: expiringSoon.length, items: expiringSoon },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/stock-movement
const getStockMovement = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const where = {};
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to + 'T23:59:59.999Z');
    }

    const transfers = await prisma.inventoryTransfer.findMany({
      where,
      include: {
        product: true,
        user: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const totalTransferred = transfers.reduce((sum, t) => sum + t.quantity, 0);

    res.json({
      success: true,
      data: {
        total_transfers: transfers.length,
        total_quantity_moved: totalTransferred,
        transfers,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/export
const exportReport = async (req, res, next) => {
  try {
    const { type, report } = req.query;

    if (type !== 'csv') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Only CSV export is supported' },
      });
    }

    let data = [];
    let headers = [];

    if (report === 'sales') {
      headers = ['Sale Number', 'Date', 'Type', 'Subtotal', 'Discount', 'Total', 'Status', 'Cashier'];
      const sales = await prisma.sale.findMany({
        include: { cashier: { select: { full_name: true } } },
        orderBy: { created_at: 'desc' },
      });
      data = sales.map((s) => [
        s.sale_number, s.created_at.toISOString().slice(0, 10),
        s.sale_type, s.subtotal, s.discount_amount, s.total_amount,
        s.status, s.cashier.full_name,
      ]);
    } else if (report === 'inventory') {
      headers = ['Product', 'Location', 'Batch', 'Quantity', 'Expiry Date', 'Supplier'];
      const inventory = await prisma.inventory.findMany({
        include: { product: true },
        orderBy: { product: { name: 'asc' } },
      });
      data = inventory.map((inv) => [
        inv.product.name, inv.location, inv.batch_number, inv.quantity,
        inv.expiry_date?.toISOString().slice(0, 10) || '', inv.supplier_name || '',
      ]);
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Invalid report type. Use: sales, inventory' },
      });
    }

    const csv = [
      headers.join(','),
      ...data.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${report}_report.csv`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const [
      todaySales, todayRevenue, pendingRx, lowStockCount,
      expiringCount, recentSales, weekSales,
    ] = await Promise.all([
      // Today's sale count
      prisma.sale.count({
        where: { created_at: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
      }),
      // Today's revenue
      prisma.sale.aggregate({
        where: { created_at: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
        _sum: { total_amount: true },
      }),
      // Pending prescriptions
      prisma.prescription.count({ where: { status: 'PENDING' } }),
      // Low stock items
      prisma.product.count({
        where: {
          is_active: true,
          inventory: {
            none: {
              quantity: { gt: 0 },
            },
          },
        },
      }),
      // Expiring items within 30 days
      prisma.inventory.count({
        where: {
          expiry_date: { gte: new Date(), lte: thirtyDays },
          quantity: { gt: 0 },
        },
      }),
      // Recent 5 sales
      prisma.sale.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          cashier: { select: { full_name: true } },
          _count: { select: { items: true } },
        },
      }),
      // Last 7 days sales for chart
      prisma.sale.findMany({
        where: {
          created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          status: 'COMPLETED',
        },
        select: { total_amount: true, created_at: true },
      }),
    ]);

    // Process weekly chart data
    const weeklyData = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weeklyData[key] = 0;
    }
    for (const sale of weekSales) {
      const key = sale.created_at.toISOString().slice(0, 10);
      if (weeklyData[key] !== undefined) {
        weeklyData[key] += parseFloat(sale.total_amount);
      }
    }

    res.json({
      success: true,
      data: {
        today_sales: todaySales,
        today_revenue: parseFloat(todayRevenue._sum.total_amount || 0),
        pending_prescriptions: pendingRx,
        low_stock_count: lowStockCount,
        expiring_count: expiringCount,
        recent_sales: recentSales,
        weekly_chart: Object.entries(weeklyData).map(([date, revenue]) => ({ date, revenue })),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSalesReport, getInventoryReport, getFinancialReport,
  getPrescriptionReport, getExpiringReport, getStockMovement,
  exportReport, getDashboard,
};
