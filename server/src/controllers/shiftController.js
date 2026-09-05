const prisma = require('../config/database');

// GET /api/v1/shifts/current
const getCurrentShift = async (req, res, next) => {
  try {
    const shift = await prisma.workShift.findFirst({
      where: {
        user_id: req.user.id,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, full_name: true, username: true, role: true } },
      },
      orderBy: { start_time: 'desc' },
    });

    if (!shift) {
      return res.json({ success: true, data: null, message: 'No active shift' });
    }

    // Calculate live running shift metrics
    const startTime = shift.start_time;

    if (req.user.role === 'CASHIER' || shift.role === 'CASHIER') {
      // Find all payments processed during this shift
      const payments = await prisma.payment.findMany({
        where: {
          sale: {
            OR: [
              { shift_id: shift.id },
              { cashier_id: req.user.id, created_at: { gte: startTime } },
            ],
            status: 'COMPLETED',
          },
        },
        include: { payment_method: true },
      });

      const methodBreakdown = {};
      let totalCollected = 0;

      for (const p of payments) {
        const mid = p.payment_method_id;
        const amount = parseFloat(p.amount) || 0;
        totalCollected += amount;

        if (!methodBreakdown[mid]) {
          methodBreakdown[mid] = {
            id: mid,
            name: p.payment_method?.name || 'Unknown',
            code: p.payment_method?.code || 'UNKNOWN',
            amount: 0,
            count: 0,
          };
        }
        methodBreakdown[mid].amount += amount;
        methodBreakdown[mid].count += 1;
      }

      const salesCount = await prisma.sale.count({
        where: {
          OR: [
            { shift_id: shift.id },
            { cashier_id: req.user.id, created_at: { gte: startTime } },
          ],
          status: 'COMPLETED',
        },
      });

      const openingCash = parseFloat(shift.opening_balance) || 0;
      const cashCollected = Object.values(methodBreakdown)
        .filter((m) => m.code.toUpperCase().includes('CASH'))
        .reduce((s, m) => s + m.amount, 0);

      return res.json({
        success: true,
        data: {
          shift,
          metrics: {
            role: 'CASHIER',
            total_collected: parseFloat(totalCollected.toFixed(2)),
            sales_count: salesCount,
            opening_cash: openingCash,
            expected_drawer_cash: parseFloat((openingCash + cashCollected).toFixed(2)),
            payment_methods: Object.values(methodBreakdown),
          },
        },
      });
    } else {
      // Pharmacist live shift metrics
      const approvedSales = await prisma.sale.findMany({
        where: {
          pharmacist_id: req.user.id,
          created_at: { gte: startTime },
        },
        include: { items: true },
      });

      const totalApprovedValue = approvedSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
      const totalMedicinesCount = approvedSales.reduce(
        (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.quantity, 0),
        0
      );

      const dispensedPrescriptionsCount = await prisma.prescription.count({
        where: {
          dispensed_by: req.user.id,
          updated_at: { gte: startTime },
          status: 'DISPENSED',
        },
      });

      return res.json({
        success: true,
        data: {
          shift,
          metrics: {
            role: 'PHARMACIST',
            sales_approved_count: approvedSales.length,
            total_approved_value: parseFloat(totalApprovedValue.toFixed(2)),
            medicines_dispensed_count: totalMedicinesCount,
            prescriptions_dispensed_count: dispensedPrescriptionsCount,
          },
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/shifts/start
const startShift = async (req, res, next) => {
  try {
    const existing = await prisma.workShift.findFirst({
      where: {
        user_id: req.user.id,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        data: existing,
        message: 'You already have an active shift.',
      });
    }

    const { shift_name, opening_balance } = req.body;
    const defaultName = req.user.role === 'CASHIER'
      ? `Cashier Shift - ${req.user.full_name}`
      : `Pharmacist Shift - ${req.user.full_name}`;

    const shift = await prisma.workShift.create({
      data: {
        user_id: req.user.id,
        role: req.user.role,
        shift_name: shift_name || defaultName,
        opening_balance: opening_balance !== undefined ? parseFloat(opening_balance) : 0,
        status: 'ACTIVE',
        start_time: new Date(),
      },
      include: {
        user: { select: { id: true, full_name: true, username: true, role: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'START_SHIFT',
        entity_type: 'WORK_SHIFT',
        entity_id: shift.id,
        details: {
          shift_name: shift.shift_name,
          opening_balance: shift.opening_balance,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: shift,
      message: 'Shift started successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/shifts/end
const endShift = async (req, res, next) => {
  try {
    const { shift_id, notes } = req.body;
    let targetShift;

    if (shift_id && req.user.role === 'ADMIN') {
      targetShift = await prisma.workShift.findUnique({ where: { id: shift_id } });
    } else {
      targetShift = await prisma.workShift.findFirst({
        where: {
          user_id: req.user.id,
          status: 'ACTIVE',
        },
      });
    }

    if (!targetShift) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active shift found to close.' },
      });
    }

    const closed = await prisma.workShift.update({
      where: { id: targetShift.id },
      data: {
        status: 'CLOSED',
        end_time: new Date(),
        closing_notes: notes || null,
      },
      include: {
        user: { select: { id: true, full_name: true, username: true, role: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'END_SHIFT',
        entity_type: 'WORK_SHIFT',
        entity_id: targetShift.id,
        details: {
          duration_minutes: Math.round((new Date() - new Date(targetShift.start_time)) / 60000),
          notes,
        },
      },
    });

    res.json({
      success: true,
      data: closed,
      message: 'Shift closed successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/shifts
const getShifts = async (req, res, next) => {
  try {
    const { date, user_id, role, status } = req.query;
    const where = {};

    if (status) where.status = status;
    if (role) where.role = role;
    if (user_id) where.user_id = user_id;

    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      where.start_time = { gte: startOfDay, lte: endOfDay };
    }

    const shifts = await prisma.workShift.findMany({
      where,
      include: {
        user: { select: { id: true, full_name: true, username: true, role: true } },
        reconciliations: true,
        _count: { select: { sales: true } },
      },
      orderBy: { start_time: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: shifts,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/shifts/summary?date=YYYY-MM-DD
const getShiftSummary = async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

    // 1. Currently active staff on duty
    const activeStaff = await prisma.workShift.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, full_name: true, username: true, role: true } },
      },
      orderBy: { start_time: 'desc' },
    });

    // 2. All cashier shifts for this date
    const cashierShifts = await prisma.workShift.findMany({
      where: {
        role: 'CASHIER',
        start_time: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        user: { select: { id: true, full_name: true, username: true } },
        reconciliations: {
          include: { entries: { include: { payment_method: true } } },
        },
      },
      orderBy: { start_time: 'asc' },
    });

    // Calculate detailed metrics for each cashier shift
    const enrichedCashierShifts = await Promise.all(
      cashierShifts.map(async (shift) => {
        const endTime = shift.end_time || new Date();
        const payments = await prisma.payment.findMany({
          where: {
            sale: {
              OR: [
                { shift_id: shift.id },
                { cashier_id: shift.user_id, created_at: { gte: shift.start_time, lte: endTime } },
              ],
              status: 'COMPLETED',
            },
          },
          include: { payment_method: true },
        });

        const totalCollected = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const transactionCount = new Set(payments.map((p) => p.sale_id)).size;

        const linkedReconciliation = shift.reconciliations[0] || null;

        return {
          id: shift.id,
          shift_name: shift.shift_name,
          cashier: shift.user,
          start_time: shift.start_time,
          end_time: shift.end_time,
          status: shift.status,
          opening_balance: parseFloat(shift.opening_balance || 0),
          total_collected: parseFloat(totalCollected.toFixed(2)),
          transaction_count: transactionCount,
          reconciliation: linkedReconciliation
            ? {
                id: linkedReconciliation.id,
                status: linkedReconciliation.status,
                total_expected: parseFloat(linkedReconciliation.total_expected),
                total_actual: parseFloat(linkedReconciliation.total_actual),
                total_discrepancy: parseFloat(linkedReconciliation.total_discrepancy),
                notes: linkedReconciliation.notes,
              }
            : null,
        };
      })
    );

    // 3. Pharmacist productivity summary for this date
    const pharmacists = await prisma.user.findMany({
      where: { role: 'PHARMACIST', is_active: true },
      select: { id: true, full_name: true, username: true },
    });

    const pharmacistSummary = await Promise.all(
      pharmacists.map(async (pharma) => {
        const approvedSales = await prisma.sale.findMany({
          where: {
            pharmacist_id: pharma.id,
            created_at: { gte: startOfDay, lte: endOfDay },
          },
          include: { items: true },
        });

        const totalApprovedVolume = approvedSales.reduce((s, sale) => s + parseFloat(sale.total_amount || 0), 0);
        const totalItemsDispensed = approvedSales.reduce(
          (s, sale) => s + sale.items.reduce((iSum, item) => iSum + item.quantity, 0),
          0
        );

        const dispensedPrescriptions = await prisma.prescription.count({
          where: {
            dispensed_by: pharma.id,
            updated_at: { gte: startOfDay, lte: endOfDay },
            status: 'DISPENSED',
          },
        });

        return {
          pharmacist: pharma,
          sales_approved: approvedSales.length,
          total_volume: parseFloat(totalApprovedVolume.toFixed(2)),
          items_dispensed: totalItemsDispensed,
          prescriptions_dispensed: dispensedPrescriptions,
        };
      })
    );

    res.json({
      success: true,
      data: {
        date: dateStr,
        active_staff: activeStaff,
        cashier_shifts: enrichedCashierShifts,
        pharmacist_summary: pharmacistSummary.filter(
          (p) => p.sales_approved > 0 || p.prescriptions_dispensed > 0
        ),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCurrentShift,
  startShift,
  endShift,
  getShifts,
  getShiftSummary,
};
