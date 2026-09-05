const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// ─── GET /api/v1/reconciliation/preview?date=YYYY-MM-DD&type=SHIFT|DAILY&shift_id=... ───
// Auto-generates expected totals from the payments table for a given date or specific shift.
const getReconciliationPreview = async (req, res, next) => {
  try {
    const { type, shift_id, cashier_id } = req.query;
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    const reconciliationType = type === 'SHIFT' ? 'SHIFT' : 'DAILY';

    let targetShift = null;
    let paymentWhere = {
      sale: { status: 'COMPLETED' },
    };

    if (reconciliationType === 'SHIFT') {
      // Find the specific shift: either by shift_id, or the caller's active/recent shift
      if (shift_id) {
        targetShift = await prisma.workShift.findUnique({
          where: { id: shift_id },
          include: { user: { select: { id: true, full_name: true, username: true, role: true } } },
        });
      } else {
        const targetUserId = cashier_id || req.user.id;
        targetShift = await prisma.workShift.findFirst({
          where: {
            user_id: targetUserId,
            status: 'ACTIVE',
          },
          include: { user: { select: { id: true, full_name: true, username: true, role: true } } },
          orderBy: { start_time: 'desc' },
        }) || await prisma.workShift.findFirst({
          where: {
            user_id: targetUserId,
            start_time: { gte: startOfDay, lte: endOfDay },
          },
          include: { user: { select: { id: true, full_name: true, username: true, role: true } } },
          orderBy: { start_time: 'desc' },
        });
      }

      if (targetShift) {
        const shiftEnd = targetShift.end_time || new Date();
        paymentWhere = {
          created_at: { gte: targetShift.start_time, lte: shiftEnd },
          sale: {
            OR: [
              { shift_id: targetShift.id },
              { cashier_id: targetShift.user_id },
            ],
            status: 'COMPLETED',
          },
        };
      } else {
        // Fallback: cashier transactions on this date
        const targetUserId = cashier_id || req.user.id;
        paymentWhere = {
          created_at: { gte: startOfDay, lte: endOfDay },
          sale: {
            cashier_id: targetUserId,
            status: 'COMPLETED',
          },
        };
      }
    } else {
      // DAILY master reconciliation preview
      paymentWhere = {
        created_at: { gte: startOfDay, lte: endOfDay },
        sale: { status: 'COMPLETED' },
      };
    }

    // Check if a reconciliation already exists for this scope
    let existing = null;
    if (reconciliationType === 'SHIFT' && targetShift) {
      existing = await prisma.reconciliation.findFirst({
        where: {
          shift_id: targetShift.id,
        },
      });
    } else {
      existing = await prisma.reconciliation.findFirst({
        where: {
          reconciliation_date: startOfDay,
          reconciliation_type: 'DAILY',
        },
      });
    }

    // Get all completed sales payments for this scope
    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        payment_method: true,
        sale: {
          select: {
            id: true,
            sale_number: true,
            total_amount: true,
            created_at: true,
            cashier: { select: { id: true, full_name: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Get all active payment methods so we always show all channels
    const allMethods = await prisma.paymentMethod.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    // Group payments by payment method
    const methodMap = {};
    for (const method of allMethods) {
      methodMap[method.id] = {
        payment_method_id: method.id,
        method_name: method.name,
        method_code: method.code,
        expected_amount: 0,
        transaction_count: 0,
        reference_numbers: [],
        transactions: [],
      };
    }

    for (const payment of payments) {
      const mid = payment.payment_method_id;
      if (!methodMap[mid]) {
        methodMap[mid] = {
          payment_method_id: mid,
          method_name: payment.payment_method?.name || 'Unknown',
          method_code: payment.payment_method?.code || 'UNKNOWN',
          expected_amount: 0,
          transaction_count: 0,
          reference_numbers: [],
          transactions: [],
        };
      }

      const amount = parseFloat(payment.amount);
      methodMap[mid].expected_amount += amount;
      methodMap[mid].transaction_count += 1;

      if (payment.reference_number) {
        methodMap[mid].reference_numbers.push(payment.reference_number);
      }

      methodMap[mid].transactions.push({
        sale_number: payment.sale.sale_number,
        amount,
        time: payment.created_at.toISOString(),
        reference: payment.reference_number || null,
        cashier: payment.sale.cashier?.full_name || 'Cashier',
      });
    }

    const methods = Object.values(methodMap).map((m) => ({
      ...m,
      expected_amount: parseFloat(m.expected_amount.toFixed(2)),
    }));

    const grand_total = methods.reduce((sum, m) => sum + m.expected_amount, 0);
    const totalTransactions = new Set(payments.map((p) => p.sale_id)).size;

    // For Daily reconciliation: fetch all shifts that ran today so owner sees breakdown
    let dailyShifts = [];
    if (reconciliationType === 'DAILY') {
      const shiftsToday = await prisma.workShift.findMany({
        where: {
          start_time: { gte: startOfDay, lte: endOfDay },
          role: 'CASHIER',
        },
        include: {
          user: { select: { id: true, full_name: true, username: true } },
          reconciliations: true,
        },
        orderBy: { start_time: 'asc' },
      });

      dailyShifts = shiftsToday.map((s) => ({
        id: s.id,
        shift_name: s.shift_name,
        cashier: s.user,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        opening_balance: parseFloat(s.opening_balance || 0),
        reconciliation_status: s.reconciliations[0]?.status || 'PENDING_CLOSE',
        reconciliation_id: s.reconciliations[0]?.id || null,
        discrepancy: s.reconciliations[0] ? parseFloat(s.reconciliations[0].total_discrepancy) : null,
      }));
    }

    res.json({
      success: true,
      data: {
        date,
        reconciliation_type: reconciliationType,
        shift: targetShift,
        already_reconciled: !!existing,
        existing_reconciliation_id: existing?.id || null,
        existing_status: existing?.status || null,
        total_sales: totalTransactions,
        grand_total: parseFloat(grand_total.toFixed(2)),
        methods,
        daily_shifts: dailyShifts,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/reconciliation ───
// Creates a reconciliation record (either for an individual shift or master daily).
const createReconciliation = async (req, res, next) => {
  try {
    const {
      date,
      reconciliation_type = 'DAILY',
      shift_id,
      entries,
      opening_balance,
      notes,
    } = req.body;

    if (!date || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Date and entries array are required' },
      });
    }

    const startOfDay = new Date(date + 'T00:00:00.000Z');
    let targetShift = null;

    if (reconciliation_type === 'SHIFT') {
      if (shift_id) {
        targetShift = await prisma.workShift.findUnique({ where: { id: shift_id } });
      } else {
        targetShift = await prisma.workShift.findFirst({
          where: { user_id: req.user.id, status: 'ACTIVE' },
          orderBy: { start_time: 'desc' },
        });
      }

      if (targetShift) {
        const existingShiftRec = await prisma.reconciliation.findFirst({
          where: { shift_id: targetShift.id },
        });
        if (existingShiftRec) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'ALREADY_EXISTS',
              message: `Reconciliation for shift "${targetShift.shift_name}" already exists.`,
            },
          });
        }
      }
    } else {
      // DAILY master check
      const existingDaily = await prisma.reconciliation.findFirst({
        where: {
          reconciliation_date: startOfDay,
          reconciliation_type: 'DAILY',
        },
      });
      if (existingDaily) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ALREADY_EXISTS',
            message: `Daily reconciliation for ${date} already exists.`,
          },
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalExpected = 0;
      let totalActual = 0;
      let totalDiscrepancy = 0;

      const entryRecords = [];
      for (const entry of entries) {
        const expected = parseFloat(entry.expected_amount) || 0;
        const actual = parseFloat(entry.actual_amount) || 0;
        const discrepancy = parseFloat((actual - expected).toFixed(2));

        totalExpected += expected;
        totalActual += actual;
        totalDiscrepancy += discrepancy;

        let status = 'MATCHED';
        if (Math.abs(discrepancy) > 5) {
          status = discrepancy < 0 ? 'SHORT' : 'OVER';
        }

        entryRecords.push({
          payment_method_id: entry.payment_method_id,
          expected_amount: expected,
          actual_amount: actual,
          discrepancy,
          transaction_count: entry.transaction_count || 0,
          reference_numbers: entry.reference_numbers || [],
          status,
          notes: entry.notes || null,
        });
      }

      const parsedOpening = opening_balance !== undefined
        ? parseFloat(opening_balance)
        : (targetShift ? parseFloat(targetShift.opening_balance || 0) : 0);

      // Determine initial status:
      // - Shift reconciliation: SUBMITTED by cashier, closed and ready for owner review.
      // - Daily reconciliation by admin: SUBMITTED or APPROVED.
      const initialStatus = 'SUBMITTED';

      const reconciliation = await tx.reconciliation.create({
        data: {
          reconciliation_date: startOfDay,
          reconciliation_type: reconciliation_type === 'SHIFT' ? 'SHIFT' : 'DAILY',
          shift_id: targetShift ? targetShift.id : null,
          cashier_id: targetShift ? targetShift.user_id : (req.user.role === 'CASHIER' ? req.user.id : null),
          shift_name: targetShift ? targetShift.shift_name : null,
          status: initialStatus,
          total_expected: parseFloat(totalExpected.toFixed(2)),
          total_actual: parseFloat(totalActual.toFixed(2)),
          total_discrepancy: parseFloat(totalDiscrepancy.toFixed(2)),
          opening_balance: parsedOpening,
          notes: notes || null,
          created_by: req.user.id,
          entries: {
            create: entryRecords,
          },
        },
        include: {
          entries: { include: { payment_method: true } },
          creator: { select: { id: true, full_name: true, username: true } },
          cashier: { select: { id: true, full_name: true, username: true } },
          shift: true,
        },
      });

      // If this is a shift reconciliation and the shift was active, CLOSE the shift now!
      if (targetShift && targetShift.status === 'ACTIVE') {
        await tx.workShift.update({
          where: { id: targetShift.id },
          data: {
            status: 'CLOSED',
            end_time: new Date(),
            closing_notes: notes || 'Closed via shift reconciliation',
          },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'CREATE_RECONCILIATION',
          entity_type: 'RECONCILIATION',
          entity_id: reconciliation.id,
          details: {
            date,
            reconciliation_type,
            shift_id: targetShift?.id || null,
            total_expected: totalExpected,
            total_actual: totalActual,
            total_discrepancy: totalDiscrepancy,
          },
        },
      });

      return reconciliation;
    });

    res.status(201).json({
      success: true,
      data: result,
      message: reconciliation_type === 'SHIFT'
        ? 'Shift reconciliation submitted and shift closed successfully.'
        : 'Daily reconciliation created successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/reconciliation ───
// List reconciliations with filters (reconciliation_type, status, date, cashier_id).
const getReconciliations = async (req, res, next) => {
  try {
    const { status, date, type, cashier_id, page = 1, limit = 20 } = req.query;
    const where = {};

    if (status && status !== 'ALL') where.status = status;
    if (type && type !== 'ALL') where.reconciliation_type = type;
    if (cashier_id) where.cashier_id = cashier_id;

    if (date) {
      where.reconciliation_date = new Date(date + 'T00:00:00.000Z');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reconciliations, total] = await Promise.all([
      prisma.reconciliation.findMany({
        where,
        include: {
          creator: { select: { id: true, full_name: true, username: true } },
          approver: { select: { id: true, full_name: true, username: true } },
          cashier: { select: { id: true, full_name: true, username: true } },
          shift: { select: { id: true, shift_name: true, start_time: true, end_time: true, status: true } },
          entries: { include: { payment_method: true } },
        },
        orderBy: [{ reconciliation_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: parseInt(limit),
      }),
      prisma.reconciliation.count({ where }),
    ]);

    res.json({
      success: true,
      data: reconciliations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/reconciliation/:id ───
const getReconciliation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const reconciliation = await prisma.reconciliation.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, full_name: true, username: true } },
        approver: { select: { id: true, full_name: true, username: true } },
        cashier: { select: { id: true, full_name: true, username: true } },
        shift: true,
        entries: {
          include: { payment_method: true },
          orderBy: { payment_method: { sort_order: 'asc' } },
        },
      },
    });

    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reconciliation record not found' },
      });
    }

    res.json({ success: true, data: reconciliation });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/reconciliation/:id/approve ───
// Restricted strictly to the OWNER / SUPER ADMIN
const approveReconciliation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action = 'APPROVED', notes } = req.body;

    if (!['APPROVED', 'FLAGGED'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Action must be either APPROVED or FLAGGED' },
      });
    }

    const current = await prisma.reconciliation.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reconciliation record not found' },
      });
    }

    const updated = await prisma.reconciliation.update({
      where: { id },
      data: {
        status: action,
        approved_by: req.user.id,
        notes: notes ? (current.notes ? `${current.notes}\n[Owner Review]: ${notes}` : notes) : current.notes,
      },
      include: {
        creator: { select: { id: true, full_name: true, username: true } },
        approver: { select: { id: true, full_name: true, username: true } },
        cashier: { select: { id: true, full_name: true, username: true } },
        shift: true,
        entries: { include: { payment_method: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: action === 'APPROVED' ? 'APPROVE_RECONCILIATION' : 'FLAG_RECONCILIATION',
        entity_type: 'RECONCILIATION',
        entity_id: id,
        details: { action, notes },
      },
    });

    res.json({
      success: true,
      data: updated,
      message: `Reconciliation successfully ${action.toLowerCase()} by owner.`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/reconciliation/export?date=YYYY-MM-DD ───
const exportReconciliation = async (req, res, next) => {
  try {
    const { date, id } = req.query;
    let reconciliation;

    if (id) {
      reconciliation = await prisma.reconciliation.findUnique({
        where: { id },
        include: {
          creator: true,
          approver: true,
          cashier: true,
          shift: true,
          entries: { include: { payment_method: true } },
        },
      });
    } else if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      reconciliation = await prisma.reconciliation.findFirst({
        where: { reconciliation_date: startOfDay, reconciliation_type: 'DAILY' },
        include: {
          creator: true,
          approver: true,
          cashier: true,
          shift: true,
          entries: { include: { payment_method: true } },
        },
      });
    }

    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No reconciliation record found to export' },
      });
    }

    const lines = [
      `TilexPharmacy - Reconciliation Report (${reconciliation.reconciliation_type})`,
      `Date,${new Date(reconciliation.reconciliation_date).toISOString().slice(0, 10)}`,
      `Type,${reconciliation.reconciliation_type}`,
      `Shift,${reconciliation.shift_name || 'All Shifts (Daily Master)'}`,
      `Cashier,${reconciliation.cashier?.full_name || 'All'}`,
      `Status,${reconciliation.status}`,
      `Created By,${reconciliation.creator?.full_name || 'N/A'}`,
      `Approved By,${reconciliation.approver?.full_name || 'N/A'}`,
      `Opening Balance (ETB),${reconciliation.opening_balance || 0}`,
      `Total Expected (ETB),${reconciliation.total_expected}`,
      `Total Actual (ETB),${reconciliation.total_actual}`,
      `Total Discrepancy (ETB),${reconciliation.total_discrepancy}`,
      '',
      'Payment Method,Channel Code,Expected (ETB),Actual (ETB),Discrepancy (ETB),Tx Count,Status,Notes',
    ];

    for (const entry of reconciliation.entries) {
      lines.push(
        [
          `"${entry.payment_method.name}"`,
          entry.payment_method.code,
          entry.expected_amount,
          entry.actual_amount,
          entry.discrepancy,
          entry.transaction_count,
          entry.status,
          `"${entry.notes || ''}"`,
        ].join(',')
      );
    }

    const csv = lines.join('\n');
    const filename = `reconciliation_${reconciliation.reconciliation_type}_${new Date(reconciliation.reconciliation_date).toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getReconciliationPreview,
  createReconciliation,
  getReconciliations,
  getReconciliation,
  approveReconciliation,
  exportReconciliation,
};
