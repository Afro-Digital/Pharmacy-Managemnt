import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api, { API_BASE } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import {
  Scale,
  Calendar,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Flag,
  Banknote,
  CreditCard,
  Smartphone,
  Building,
} from 'lucide-react';

const getMethodIcon = (code) => {
  const lower = (code || '').toLowerCase();
  if (lower.includes('cash')) return Banknote;
  if (lower.includes('telebirr') || lower.includes('mobile')) return Smartphone;
  if (lower.includes('cbe') || lower.includes('boa') || lower.includes('bank')) return Building;
  return CreditCard;
};

export const ReconciliationPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canApprove = ['ADMIN', 'PHARMACIST'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('NEW'); // 'NEW' | 'HISTORY'

  // New Reconciliation State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [entryValues, setEntryValues] = useState({}); // { [methodId]: { actual: '', notes: '' } }
  const [openingBalance, setOpeningBalance] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedMethod, setExpandedMethod] = useState(null);

  // History State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detailModal, setDetailModal] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [approveAction, setApproveAction] = useState('APPROVED');
  const [approveNotes, setApproveNotes] = useState('');

  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Auto-dismiss alerts
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // ─── Preview (New Reconciliation) ──────────────────────

  const fetchPreview = async () => {
    setPreviewLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get(`/reconciliation/preview?date=${selectedDate}`);
      if (res.data.success) {
        setPreview(res.data.data);

        // Pre-fill actual amounts with expected amounts for convenience
        const vals = {};
        for (const m of res.data.data.methods) {
          vals[m.payment_method_id] = {
            actual: m.expected_amount.toString(),
            notes: '',
          };
        }
        setEntryValues(vals);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'NEW' && selectedDate) {
      fetchPreview();
    }
  }, [selectedDate, activeTab]);

  const updateEntryValue = (methodId, field, val) => {
    setEntryValues((prev) => ({
      ...prev,
      [methodId]: { ...prev[methodId], [field]: val },
    }));
  };

  const getDiscrepancy = (methodId, expected) => {
    const actual = parseFloat(entryValues[methodId]?.actual) || 0;
    return parseFloat((actual - expected).toFixed(2));
  };

  const getEntryStatus = (disc) => {
    if (Math.abs(disc) <= 5) return 'MATCHED';
    if (disc < 0) return 'SHORT';
    return 'OVER';
  };

  const handleSubmitReconciliation = async () => {
    if (!preview) return;

    const entries = preview.methods.map((m) => {
      const actual = parseFloat(entryValues[m.payment_method_id]?.actual) || 0;
      const disc = parseFloat((actual - m.expected_amount).toFixed(2));
      const status = getEntryStatus(disc);
      const notes = entryValues[m.payment_method_id]?.notes || '';

      // Require notes for discrepancies > ±5 ETB
      if ((status === 'SHORT' || status === 'OVER') && !notes) {
        setErrorMessage(
          `Please add an explanation note for the ${m.method_name} discrepancy (${disc > 0 ? '+' : ''}${disc.toFixed(2)} ETB)`
        );
        return null;
      }

      return {
        payment_method_id: m.payment_method_id,
        expected_amount: m.expected_amount,
        actual_amount: actual,
        transaction_count: m.transaction_count,
        reference_numbers: m.reference_numbers,
        notes,
      };
    });

    if (entries.includes(null)) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/reconciliation', {
        date: selectedDate,
        entries,
        opening_balance: parseFloat(openingBalance) || 0,
        notes: globalNotes || undefined,
      });

      if (res.data.success) {
        setSuccessMessage(res.data.message);
        setPreview(null);
        setEntryValues({});
        setOpeningBalance('');
        setGlobalNotes('');
        fetchPreview(); // Refresh to show "already reconciled"
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to submit reconciliation');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── History ───────────────────────────────────────────

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.get('/reconciliation', { params });
      if (res.data.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load reconciliation history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab, statusFilter]);

  const fetchDetail = async (id) => {
    try {
      const res = await api.get(`/reconciliation/${id}`);
      if (res.data.success) {
        setDetailModal(res.data.data);
      }
    } catch (err) {
      setErrorMessage('Failed to load reconciliation details');
    }
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      const res = await api.post(`/reconciliation/${approveModal.id}/approve`, {
        action: approveAction,
        notes: approveNotes || undefined,
      });
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        setApproveModal(null);
        setApproveNotes('');
        fetchHistory();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to process approval');
    }
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('tilex_access_token');
    window.open(`${API_BASE}/reconciliation/export?token=${token}`, '_blank');
  };

  // ─── Status Badge Helper ──────────────────────────────

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="neutral">Draft</Badge>;
      case 'SUBMITTED': return <Badge variant="warning">Submitted</Badge>;
      case 'APPROVED': return <Badge variant="success">Approved</Badge>;
      case 'FLAGGED': return <Badge variant="danger">Flagged</Badge>;
      case 'MATCHED': return <Badge variant="success">Matched</Badge>;
      case 'SHORT': return <Badge variant="danger">Short</Badge>;
      case 'OVER': return <Badge variant="warning">Over</Badge>;
      case 'PENDING': return <Badge variant="neutral">Pending</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // ─── Computed Totals for New Reconciliation ────────────

  const totalExpected = preview?.grand_total || 0;
  const totalActual = preview
    ? preview.methods.reduce((sum, m) => sum + (parseFloat(entryValues[m.payment_method_id]?.actual) || 0), 0)
    : 0;
  const totalDiscrepancy = parseFloat((totalActual - totalExpected).toFixed(2));
  const overallStatus = getEntryStatus(totalDiscrepancy);

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Daily Reconciliation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verify daily income across Cash, Telebirr, CBE, BOA, and all payment platforms
          </p>
        </div>

        {activeTab === 'HISTORY' && (
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200/50">
        <button
          onClick={() => setActiveTab('NEW')}
          className={`px-5 py-2 text-xs font-bold rounded-full transition-all ${
            activeTab === 'NEW'
              ? 'bg-white text-[#5345E6] shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          New Reconciliation
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-5 py-2 text-xs font-bold rounded-full transition-all ${
            activeTab === 'HISTORY'
              ? 'bg-white text-[#5345E6] shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          History
        </button>
      </div>

      {/* Alerts */}
      {errorMessage && <Alert type="error" message={errorMessage} onClose={() => setErrorMessage(null)} />}
      {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />}

      {/* ════════════════════════════════════════════════════════ */}
      {/* NEW RECONCILIATION TAB                                  */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'NEW' && (
        <div className="space-y-5">
          {/* Date Picker & Preview Button */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-[#5345E6]" />
                  Reconciliation Date
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                  <Banknote className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-emerald-600" />
                  Opening Cash Drawer Balance (ETB)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 500.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </div>
              <Button
                onClick={fetchPreview}
                isLoading={previewLoading}
                className="text-xs font-bold px-5 py-2.5 bg-[#5345E6] hover:bg-[#4336D6] text-white rounded-xl"
              >
                <Scale className="w-3.5 h-3.5 mr-1.5" /> Generate Preview
              </Button>
            </div>
          </Card>

          {/* Already Reconciled Warning */}
          {preview?.already_reconciled && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Already Reconciled:</strong> A reconciliation for{' '}
                <span className="font-mono font-bold">{selectedDate}</span> already exists with status{' '}
                {getStatusBadge(preview.existing_status)}. You cannot create a duplicate.
              </div>
            </div>
          )}

          {/* Preview Results */}
          {preview && !preview.already_reconciled && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">{selectedDate}</h3>
                </Card>
                <Card className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sales</span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">{preview.total_sales}</h3>
                  <span className="text-[11px] text-slate-400">Completed transactions</span>
                </Card>
                <Card className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">System Total</span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                  </h3>
                </Card>
                <Card className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Discrepancy
                  </span>
                  <h3 className={`text-lg font-black mt-1 ${
                    overallStatus === 'MATCHED' ? 'text-emerald-600' : overallStatus === 'SHORT' ? 'text-rose-600' : 'text-amber-600'
                  }`}>
                    {totalDiscrepancy > 0 ? '+' : ''}{totalDiscrepancy.toFixed(2)} ETB
                  </h3>
                  {getStatusBadge(overallStatus)}
                </Card>
              </div>

              {/* Payment Method Breakdown */}
              <Card className="overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Payment Method Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Enter the actual amount verified for each payment channel. The system auto-populated the expected totals from today's transactions.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {preview.methods.map((method) => {
                    const disc = getDiscrepancy(method.payment_method_id, method.expected_amount);
                    const status = getEntryStatus(disc);
                    const isExpanded = expandedMethod === method.payment_method_id;
                    const MethodIcon = getMethodIcon(method.method_code);

                    return (
                      <div key={method.payment_method_id}>
                        <div className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-4">
                            {/* Method Name & Icon */}
                            <div className="flex items-center space-x-3 min-w-[160px]">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                                <MethodIcon className="w-4.5 h-4.5 text-slate-600" />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-900 block">
                                  {method.method_name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {method.transaction_count} transactions
                                </span>
                              </div>
                            </div>

                            {/* Expected (read-only) */}
                            <div className="flex-1 max-w-[140px]">
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                EXPECTED
                              </label>
                              <div className="text-sm font-mono font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                {method.expected_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </div>

                            {/* Actual (editable) */}
                            <div className="flex-1 max-w-[160px]">
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                ACTUAL (Verified)
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                value={entryValues[method.payment_method_id]?.actual || ''}
                                onChange={(e) =>
                                  updateEntryValue(method.payment_method_id, 'actual', e.target.value)
                                }
                                placeholder="0.00"
                                disabled={preview.already_reconciled}
                              />
                            </div>

                            {/* Discrepancy & Status */}
                            <div className="flex-1 max-w-[130px] text-center">
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                DIFF
                              </label>
                              <div className={`text-sm font-mono font-bold px-3 py-1.5 rounded-lg border ${
                                status === 'MATCHED'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : status === 'SHORT'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700'
                              }`}>
                                {disc > 0 ? '+' : ''}{disc.toFixed(2)}
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="min-w-[80px]">
                              {getStatusBadge(status)}
                            </div>

                            {/* Expand Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedMethod(isExpanded ? null : method.payment_method_id)
                              }
                              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#5345E6] transition-colors"
                              title="View individual transactions"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {/* Notes (required for discrepancies) */}
                          {(status === 'SHORT' || status === 'OVER') && (
                            <div className="mt-3 ml-12">
                              <Input
                                placeholder={`Explain ${method.method_name} discrepancy (${disc > 0 ? '+' : ''}${disc.toFixed(2)} ETB)...`}
                                value={entryValues[method.payment_method_id]?.notes || ''}
                                onChange={(e) =>
                                  updateEntryValue(method.payment_method_id, 'notes', e.target.value)
                                }
                              />
                            </div>
                          )}
                        </div>

                        {/* Expanded Transaction List */}
                        {isExpanded && (
                          <div className="px-4 pb-4 bg-slate-50/60">
                            <div className="ml-12 border border-slate-200 rounded-xl overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-500 font-semibold">
                                  <tr>
                                    <th className="p-2.5">Sale #</th>
                                    <th className="p-2.5">Time</th>
                                    <th className="p-2.5 text-right">Amount</th>
                                    <th className="p-2.5">Reference #</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {method.transactions.length === 0 ? (
                                    <tr>
                                      <td colSpan="4" className="p-4 text-center text-slate-400">
                                        No transactions for this method on {selectedDate}
                                      </td>
                                    </tr>
                                  ) : (
                                    method.transactions.map((txn, i) => (
                                      <tr key={i} className="hover:bg-white">
                                        <td className="p-2.5 font-mono font-bold text-[#5345E6]">
                                          {txn.sale_number}
                                        </td>
                                        <td className="p-2.5 text-slate-600">
                                          {new Date(txn.time).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                                          {txn.amount.toFixed(2)} ETB
                                        </td>
                                        <td className="p-2.5 font-mono text-slate-500">
                                          {txn.reference || '—'}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Submit Footer */}
                {!preview.already_reconciled && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                    <Input
                      placeholder="Overall reconciliation notes (optional)..."
                      value={globalNotes}
                      onChange={(e) => setGlobalNotes(e.target.value)}
                    />
                    <Button
                      onClick={handleSubmitReconciliation}
                      isLoading={submitting}
                      className="w-full py-3 text-sm font-bold bg-[#5345E6] hover:bg-[#4336D6] text-white rounded-xl shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit Reconciliation for {selectedDate}
                    </Button>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Empty State */}
          {!preview && !previewLoading && (
            <Card className="p-12 text-center">
              <Scale className="w-14 h-14 mx-auto text-slate-300 mb-4 stroke-1" />
              <p className="text-sm font-bold text-slate-700">Select a Date to Begin</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Choose a date above and click "Generate Preview" to auto-populate expected payment
                totals from the system's transaction records.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* HISTORY TAB                                             */}
      {/* ════════════════════════════════════════════════════════ */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4">
          {/* Status Filter Pills */}
          <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200/50">
            {['ALL', 'SUBMITTED', 'APPROVED', 'FLAGGED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                  statusFilter === s
                    ? 'bg-white text-[#5345E6] shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'All Records' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* History Table */}
          <Table
            columns={[
              {
                header: 'Date',
                accessor: 'reconciliation_date',
                render: (row) => (
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {new Date(row.reconciliation_date).toLocaleDateString('en-GB')}
                  </span>
                ),
              },
              {
                header: 'Expected',
                accessor: 'total_expected',
                render: (row) => (
                  <span className="font-mono text-sm text-slate-700">
                    {parseFloat(row.total_expected).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{' '}
                    ETB
                  </span>
                ),
              },
              {
                header: 'Actual',
                accessor: 'total_actual',
                render: (row) => (
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {parseFloat(row.total_actual).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{' '}
                    ETB
                  </span>
                ),
              },
              {
                header: 'Discrepancy',
                accessor: 'total_discrepancy',
                render: (row) => {
                  const d = parseFloat(row.total_discrepancy);
                  return (
                    <span
                      className={`font-mono font-bold text-sm ${
                        Math.abs(d) <= 5
                          ? 'text-emerald-600'
                          : d < 0
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {d > 0 ? '+' : ''}
                      {d.toFixed(2)} ETB
                    </span>
                  );
                },
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (row) => getStatusBadge(row.status),
              },
              {
                header: 'Created By',
                accessor: 'creator',
                render: (row) => (
                  <span className="text-xs text-slate-600 font-medium">
                    {row.creator?.full_name}
                  </span>
                ),
              },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row) => (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => fetchDetail(row.id)}
                      className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#5345E6] flex items-center justify-center transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canApprove && row.status === 'SUBMITTED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setApproveModal(row);
                          setApproveAction('APPROVED');
                          setApproveNotes('');
                        }}
                        className="w-8 h-8 rounded-full hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 flex items-center justify-center transition-colors"
                        title="Approve / Flag"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={history}
            isLoading={historyLoading}
            emptyMessage="No reconciliation records found"
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ */}
      {/* DETAIL MODAL                                            */}
      {/* ════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={`Reconciliation: ${detailModal ? new Date(detailModal.reconciliation_date).toLocaleDateString('en-GB') : ''}`}
        maxWidth="max-w-3xl"
      >
        {detailModal && (
          <div className="space-y-4 text-xs">
            {/* Header Info */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-sm text-slate-900 block">
                  {new Date(detailModal.reconciliation_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-slate-500 mt-0.5 block">
                  Created by: <strong>{detailModal.creator?.full_name}</strong>
                  {detailModal.approver && (
                    <> • Reviewed by: <strong>{detailModal.approver?.full_name}</strong></>
                  )}
                </span>
              </div>
              <div className="text-right space-y-1">
                {getStatusBadge(detailModal.status)}
              </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block">EXPECTED</span>
                <span className="text-base font-black text-slate-900">
                  {parseFloat(detailModal.total_expected).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block">ACTUAL</span>
                <span className="text-base font-black text-slate-900">
                  {parseFloat(detailModal.total_actual).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
              <div className={`p-3 rounded-xl text-center border ${
                Math.abs(parseFloat(detailModal.total_discrepancy)) <= 5
                  ? 'bg-emerald-50 border-emerald-200'
                  : parseFloat(detailModal.total_discrepancy) < 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <span className="text-[10px] font-bold text-slate-400 block">DISCREPANCY</span>
                <span className={`text-base font-black ${
                  Math.abs(parseFloat(detailModal.total_discrepancy)) <= 5 ? 'text-emerald-700'
                  : parseFloat(detailModal.total_discrepancy) < 0 ? 'text-rose-700' : 'text-amber-700'
                }`}>
                  {parseFloat(detailModal.total_discrepancy) > 0 ? '+' : ''}
                  {parseFloat(detailModal.total_discrepancy).toFixed(2)} ETB
                </span>
              </div>
            </div>

            {/* Entries Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Payment Method</th>
                    <th className="p-2.5 text-right">Expected</th>
                    <th className="p-2.5 text-right">Actual</th>
                    <th className="p-2.5 text-right">Diff</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailModal.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-bold text-slate-800">
                        {entry.payment_method.name}
                        <span className="text-slate-400 font-normal block">
                          {entry.transaction_count} txns
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {parseFloat(entry.expected_amount).toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {parseFloat(entry.actual_amount).toFixed(2)}
                      </td>
                      <td className={`p-2.5 text-right font-mono font-bold ${
                        entry.status === 'MATCHED' ? 'text-emerald-600'
                        : entry.status === 'SHORT' ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                        {parseFloat(entry.discrepancy) > 0 ? '+' : ''}
                        {parseFloat(entry.discrepancy).toFixed(2)}
                      </td>
                      <td className="p-2.5">{getStatusBadge(entry.status)}</td>
                      <td className="p-2.5 text-slate-500 max-w-[180px] truncate">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            {detailModal.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                <strong className="text-slate-900">Notes:</strong> {detailModal.notes}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDetailModal(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ════════════════════════════════════════════════════════ */}
      {/* APPROVE / FLAG MODAL                                    */}
      {/* ════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={!!approveModal}
        onClose={() => setApproveModal(null)}
        title="Review Reconciliation"
        maxWidth="max-w-md"
      >
        {approveModal && (
          <div className="space-y-4 text-xs">
            <p className="text-sm text-slate-700">
              Reviewing reconciliation for{' '}
              <strong>
                {new Date(approveModal.reconciliation_date).toLocaleDateString('en-GB')}
              </strong>
              . Discrepancy:{' '}
              <strong
                className={
                  Math.abs(parseFloat(approveModal.total_discrepancy)) <= 5
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }
              >
                {parseFloat(approveModal.total_discrepancy) > 0 ? '+' : ''}
                {parseFloat(approveModal.total_discrepancy).toFixed(2)} ETB
              </strong>
            </p>

            <div className="flex space-x-2">
              <button
                onClick={() => setApproveAction('APPROVED')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center space-x-2 ${
                  approveAction === 'APPROVED'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => setApproveAction('FLAGGED')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center space-x-2 ${
                  approveAction === 'FLAGGED'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Flag className="w-4 h-4" />
                <span>Flag for Review</span>
              </button>
            </div>

            <Input
              placeholder="Add review notes (optional)..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
            />

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setApproveModal(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                className={`text-white rounded-xl ${
                  approveAction === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {approveAction === 'APPROVED' ? 'Approve' : 'Flag'} Reconciliation
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
