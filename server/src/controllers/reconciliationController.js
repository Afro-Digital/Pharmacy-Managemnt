const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

// ─── GET /api/v1/reconciliation/preview?date=YYYY-MM-DD ───
// Auto-generates expected totals from the payments table for a given date.
const getReconciliationPreview = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Date parameter is required (YYYY-MM-DD)' },
      });
    }

    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    // Check if a reconciliation already exists for this date
    const existing = await prisma.reconciliation.findUnique({
      where: { reconciliation_date: startOfDay },
    });

    // Get all completed sales for this date with their payments
    const payments = await prisma.payment.findMany({
      where: {
        created_at: { gte: startOfDay, lte: endOfDay },
        sale: { status: 'COMPLETED' },
      },
      include: {
        payment_method: true,
        sale: { select: { sale_number: true, total_amount: true, created_at: true } },
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
          method_name: payment.payment_method.name,
          method_code: payment.payment_method.code,
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
      });
    }

    const methods = Object.values(methodMap).map((m) => ({
      ...m,
      expected_amount: parseFloat(m.expected_amount.toFixed(2)),
    }));

    const grand_total = methods.reduce((sum, m) => sum + m.expected_amount, 0);

    // Count total completed sales for this date
    const salesCount = await prisma.sale.count({
      where: {
        created_at: { gte: startOfDay, lte: endOfDay },
        status: 'COMPLETED',
      },
    });

    res.json({
      success: true,
      data: {
        date,
        already_reconciled: !!existing,
        existing_reconciliation_id: existing?.id || null,
        existing_status: existing?.status || null,
        total_sales: salesCount,
        grand_total: parseFloat(grand_total.toFixed(2)),
        methods,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/reconciliation ───
// Creates a reconciliation record with actual amounts entered by the admin.
const createReconciliation = async (req, res, next) => {
  try {
    const { date, entries, opening_balance, notes } = req.body;

    if (!date || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Date and entries array are required' },
      });
    }

    const startOfDay = new Date(date + 'T00:00:00.000Z');

    // Check if already reconciled
    const existing = await prisma.reconciliation.findUnique({
      where: { reconciliation_date: startOfDay },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: `Reconciliation already exists for ${date} (ID: ${existing.id}, Status: ${existing.status})` },
      });
    }

    // Calculate totals
    let totalExpected = 0;
    let totalActual = 0;

    const TOLERANCE = 5; // ETB tolerance for auto-match

    const processedEntries = entries.map((entry) => {
      const expected = parseFloat(entry.expected_amount) || 0;
      const actual = parseFloat(entry.actual_amount) || 0;
      const discrepancy = parseFloat((actual - expected).toFixed(2));

      totalExpected += expected;
      totalActual += actual;

      let status = 'PENDING';
      if (Math.abs(discrepancy) <= TOLERANCE) {
        status = 'MATCHED';
      } else if (discrepancy < 0) {
        status = 'SHORT';
      } else {
        status = 'OVER';
      }

      return {
        payment_method_id: entry.payment_method_id,
        expected_amount: expected,
        actual_amount: actual,
        discrepancy,
        transaction_count: entry.transaction_count || 0,
        reference_numbers: entry.reference_numbers || [],
        status,
        notes: entry.notes || null,
      };
    });

    const totalDiscrepancy = parseFloat((totalActual - totalExpected).toFixed(2));

    // Require notes for any entries with discrepancies beyond tolerance
    const unexlainedDiscrepancies = processedEntries.filter(
      (e) => (e.status === 'SHORT' || e.status === 'OVER') && !e.notes
    );

    if (unexlainedDiscrepancies.length > 0) {
      const methods = unexlainedDiscrepancies.map((e) => e.payment_method_id);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION',
          message: 'Discrepancies beyond ±5 ETB tolerance require an explanation note',
          methods_requiring_notes: methods,
        },
      });
    }

    // Create reconciliation record with entries atomically
    const reconciliation = await prisma.$transaction(async (tx) => {
      const recon = await tx.reconciliation.create({
        data: {
          reconciliation_date: startOfDay,
          status: 'SUBMITTED',
          total_expected: totalExpected,
          total_actual: totalActual,
          total_discrepancy: totalDiscrepancy,
          opening_balance: parseFloat(opening_balance) || 0,
          notes: notes || null,
          created_by: req.user.id,
          entries: {
            create: processedEntries,
          },
        },
        include: {
          entries: { include: { payment_method: true } },
          creator: { select: { full_name: true, username: true } },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: 'CREATE',
          entity_type: 'RECONCILIATION',
          entity_id: recon.id,
          details: {
            date,
            total_expected: totalExpected,
            total_actual: totalActual,
            total_discrepancy: totalDiscrepancy,
            entry_count: processedEntries.length,
          },
        },
      });

      return recon;
    });

    res.status(201).json({
      success: true,
      message: `Reconciliation for ${date} submitted successfully`,
      data: reconciliation,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/reconciliation ───
// Lists all past reconciliation records with filters.
const getReconciliations = async (req, res, next) => {
  try {
    const { status, from, to, limit: qLimit } = req.query;
    const limit = Math.min(parseInt(qLimit) || 50, 100);

    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.reconciliation_date = {};
      if (from) where.reconciliation_date.gte = new Date(from);
      if (to) where.reconciliation_date.lte = new Date(to + 'T23:59:59.999Z');
    }

    const reconciliations = await prisma.reconciliation.findMany({
      where,
      take: limit,
      include: {
        creator: { select: { full_name: true, username: true } },
        approver: { select: { full_name: true, username: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { reconciliation_date: 'desc' },
    });

    res.json({
      success: true,
      data: reconciliations,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/reconciliation/:id ───
// View full details of a specific reconciliation.
const getReconciliation = async (req, res, next) => {
  try {
    const reconciliation = await prisma.reconciliation.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { full_name: true, username: true } },
        approver: { select: { full_name: true, username: true } },
        entries: {
          include: { payment_method: true },
          orderBy: { expected_amount: 'desc' },
        },
      },
    });

    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reconciliation not found' },
      });
    }

    res.json({ success: true, data: reconciliation });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/reconciliation/:id/approve ───
// Approve or flag a reconciliation.
const approveReconciliation = async (req, res, next) => {
  try {
    const { action, notes } = req.body; // action: 'APPROVED' | 'FLAGGED'

    if (!['APPROVED', 'FLAGGED'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION', message: 'Action must be APPROVED or FLAGGED' },
      });
    }

    const reconciliation = await prisma.reconciliation.findUnique({
      where: { id: req.params.id },
    });

    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reconciliation not found' },
      });
    }

    if (reconciliation.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: `Cannot ${action.toLowerCase()} a reconciliation with status ${reconciliation.status}` },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const recon = await tx.reconciliation.update({
        where: { id: req.params.id },
        data: {
          status: action,
          approved_by: req.user.id,
          notes: notes ? `${reconciliation.notes || ''}\n[${action}] ${notes}`.trim() : reconciliation.notes,
        },
        include: {
          entries: { include: { payment_method: true } },
          creator: { select: { full_name: true, username: true } },
          approver: { select: { full_name: true, username: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: req.user.id,
          action: action === 'APPROVED' ? 'APPROVE' : 'FLAG',
          entity_type: 'RECONCILIATION',
          entity_id: recon.id,
          details: { action, notes: notes || null },
        },
      });

      return recon;
    });

    res.json({
      success: true,
      message: `Reconciliation ${action.toLowerCase()} successfully`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/reconciliation/export?from=...&to=... ───
// Export reconciliation data as CSV.
const exportReconciliation = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const where = {};
    if (from || to) {
      where.reconciliation_date = {};
      if (from) where.reconciliation_date.gte = new Date(from);
      if (to) where.reconciliation_date.lte = new Date(to + 'T23:59:59.999Z');
    }

    const reconciliations = await prisma.reconciliation.findMany({
      where,
      include: {
        entries: { include: { payment_method: true } },
        creator: { select: { full_name: true } },
        approver: { select: { full_name: true } },
      },
      orderBy: { reconciliation_date: 'desc' },
    });

    // Flatten into CSV rows
    const headers = [
      'Date', 'Status', 'Payment Method', 'Expected (ETB)', 'Actual (ETB)',
      'Discrepancy (ETB)', 'Transactions', 'Entry Status', 'Notes',
      'Created By', 'Approved By',
    ];

    const rows = [];
    for (const recon of reconciliations) {
      for (const entry of recon.entries) {
        rows.push([
          recon.reconciliation_date.toISOString().slice(0, 10),
          recon.status,
          entry.payment_method.name,
          entry.expected_amount,
          entry.actual_amount,
          entry.discrepancy,
          entry.transaction_count,
          entry.status,
          (entry.notes || '').replace(/"/g, '""'),
          recon.creator?.full_name || '',
          recon.approver?.full_name || '',
        ]);
      }
    }

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reconciliation_report.csv');
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
