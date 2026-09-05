import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api, { API_BASE } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { ShiftBar } from '../../components/layout/ShiftBar';
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
  UserCheck,
  ShieldCheck,
  Coins,
  RefreshCw,
  Users,
  CheckCheck,
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
  const { activeShift, refreshShift } = useShift();
  const isAdmin = user?.role === 'ADMIN';

  // Tabs: 'SHIFT_CLOSEOUT' | 'DAILY_MASTER' | 'HISTORY'
  const [activeTab, setActiveTab] = useState(isAdmin ? 'DAILY_MASTER' : 'SHIFT_CLOSEOUT');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Shift Close-out State
  const [shiftPreview, setShiftPreview] = useState(null);
  const [shiftPreviewLoading, setShiftPreviewLoading] = useState(false);
  const [shiftEntries, setShiftEntries] = useState({});
  const [shiftOpeningCash, setShiftOpeningCash] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftSubmitting, setShiftSubmitting] = useState(false);

  // Daily Master Close-out State
  const [dailyPreview, setDailyPreview] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [dailyNotes, setDailyNotes] = useState('');
  const [dailyApproving, setDailyApproving] = useState(false);

  // History State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL'); // 'ALL' | 'SHIFT' | 'DAILY'
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [detailModal, setDetailModal] = useState(null);

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

  // ─── Fetch Shift Preview ──────────────────────────────
  const fetchShiftPreview = async () => {
    setShiftPreviewLoading(true);
    setErrorMessage(null);
    try {
      const shiftIdParam = activeShift ? `&shift_id=${activeShift.id}` : '';
      const res = await api.get(`/reconciliation/preview?date=${selectedDate}&type=SHIFT${shiftIdParam}`);
      if (res.data.success) {
        setShiftPreview(res.data.data);
        setShiftOpeningCash(
          res.data.data.shift?.opening_balance?.toString() ||
            activeShift?.opening_balance?.toString() ||
            '0'
        );

        // Pre-fill actual amounts with expected
        const vals = {};
        for (const m of res.data.data.methods) {
          vals[m.payment_method_id] = {
            actual: m.expected_amount.toString(),
            notes: '',
          };
        }
        setShiftEntries(vals);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.error?.message || 'Failed to fetch shift preview');
    } finally {
      setShiftPreviewLoading(false);
    }
  };

  // ─── Fetch Daily Master Preview & Staff Summary ─────────
  const fetchDailyData = async () => {
    setDailyLoading(true);
    setErrorMessage(null);
    try {
      const [previewRes, summaryRes] = await Promise.all([
        api.get(`/reconciliation/preview?date=${selectedDate}&type=DAILY`),
        api.get(`/shifts/summary?date=${selectedDate}`),
      ]);

      if (previewRes.data.success) {
        setDailyPreview(previewRes.data.data);
      }
      if (summaryRes.data.success) {
        setDailySummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.error?.message || 'Failed to load daily reconciliation data');
    } finally {
      setDailyLoading(false);
    }
  };

  // ─── Fetch History ─────────────────────────────────────
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historyTypeFilter !== 'ALL') params.append('type', historyTypeFilter);
      if (historyStatusFilter !== 'ALL') params.append('status', historyStatusFilter);

      const res = await api.get(`/reconciliation?${params.toString()}`);
      if (res.data.success) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'SHIFT_CLOSEOUT') {
      fetchShiftPreview();
    } else if (activeTab === 'DAILY_MASTER') {
      fetchDailyData();
    } else if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab, selectedDate, activeShift?.id, historyTypeFilter, historyStatusFilter]);

  // ─── Submit Cashier Shift Reconciliation ──────────────
  const handleSubmitShiftReconciliation = async (e) => {
    e.preventDefault();
    if (!shiftPreview) return;

    setShiftSubmitting(true);
    setErrorMessage(null);
    try {
      const entriesPayload = shiftPreview.methods.map((m) => {
        const entryVal = shiftEntries[m.payment_method_id] || {};
        return {
          payment_method_id: m.payment_method_id,
          expected_amount: m.expected_amount,
          actual_amount: parseFloat(entryVal.actual) || 0,
          transaction_count: m.transaction_count,
          reference_numbers: m.reference_numbers,
          notes: entryVal.notes || '',
        };
      });

      const res = await api.post('/reconciliation', {
        date: selectedDate,
        reconciliation_type: 'SHIFT',
        shift_id: activeShift?.id || shiftPreview.shift?.id || null,
        opening_balance: parseFloat(shiftOpeningCash) || 0,
        entries: entriesPayload,
        notes: shiftNotes,
      });

      if (res.data.success) {
        setSuccessMessage('Shift reconciliation submitted and your shift is officially closed. Next cashier can start cleanly.');
        await refreshShift();
        await fetchShiftPreview();
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.error?.message || 'Failed to submit shift reconciliation');
    } finally {
      setShiftSubmitting(false);
    }
  };

  // ─── Owner Daily Master Approval ───────────────────────
  const handleApproveDailyReconciliation = async (action = 'APPROVED') => {
    if (!isAdmin) return;
    setDailyApproving(true);
    setErrorMessage(null);
    try {
      if (dailyPreview?.existing_reconciliation_id) {
        const res = await api.post(`/reconciliation/${dailyPreview.existing_reconciliation_id}/approve`, {
          action,
          notes: dailyNotes,
        });
        if (res.data.success) {
          setSuccessMessage(`Daily reconciliation ${action.toLowerCase()} by owner.`);
          fetchDailyData();
        }
      } else {
        // Create master daily reconciliation and approve it in one step
        const entriesPayload = dailyPreview.methods.map((m) => ({
          payment_method_id: m.payment_method_id,
          expected_amount: m.expected_amount,
          actual_amount: m.expected_amount,
          transaction_count: m.transaction_count,
          reference_numbers: m.reference_numbers,
        }));

        const createRes = await api.post('/reconciliation', {
          date: selectedDate,
          reconciliation_type: 'DAILY',
          opening_balance: 0,
          entries: entriesPayload,
          notes: dailyNotes || 'Master daily reconciliation approved by owner',
        });

        if (createRes.data.success) {
          const recId = createRes.data.data.id;
          await api.post(`/reconciliation/${recId}/approve`, {
            action,
            notes: dailyNotes,
          });
          setSuccessMessage(`Master daily reconciliation for ${selectedDate} finalized and approved by owner.`);
          fetchDailyData();
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.error?.message || 'Failed to approve daily reconciliation');
    } finally {
      setDailyApproving(false);
    }
  };

  // Calculations for shift preview
  const shiftTotalExpected = shiftPreview ? shiftPreview.grand_total : 0;
  const shiftTotalActual = shiftPreview
    ? shiftPreview.methods.reduce((sum, m) => {
        const val = shiftEntries[m.payment_method_id]?.actual;
        return sum + (parseFloat(val) || 0);
      }, 0)
    : 0;
  const shiftDiscrepancy = shiftTotalActual - shiftTotalExpected;

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col space-y-3 overflow-hidden">
      {/* Top Header Card */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4336D6] to-[#5345E6] flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100 dark:shadow-none flex-shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Shift & Daily Cash Reconciliation
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {isAdmin
                ? 'Owner Portal • Review individual cashier shifts and approve daily master reconciliation'
                : 'Cashier Station • Close shift, reconcile drawer, and hand over register'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-3 pr-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setActiveTab('SHIFT_CLOSEOUT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'SHIFT_CLOSEOUT'
                  ? 'bg-white dark:bg-slate-700 text-[#5345E6] dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cashier Shift Close-Out
            </button>
            <button
              onClick={() => setActiveTab('DAILY_MASTER')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'DAILY_MASTER'
                  ? 'bg-white dark:bg-slate-700 text-[#5345E6] dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Daily Master Close-Out
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-white dark:bg-slate-700 text-[#5345E6] dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              History & Audit
            </button>
          </div>
        </div>
      </div>

      {/* Active Shift status indicator */}
      <ShiftBar onReconcileClick={() => setActiveTab('SHIFT_CLOSEOUT')} />

      {successMessage && (
        <div className="flex-shrink-0">
          <Alert variant="success" onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        </div>
      )}

      {errorMessage && (
        <div className="flex-shrink-0">
          <Alert variant="error" onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CASHIER SHIFT CLOSE-OUT                                            */}
      {/* ========================================================================= */}
      {activeTab === 'SHIFT_CLOSEOUT' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
          {shiftPreviewLoading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#5345E6] mr-2" />
              <span className="text-xs font-semibold">Loading shift reconciliation data...</span>
            </div>
          ) : !shiftPreview ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <Clock className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No Shift to Reconcile</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Start a shift to record your drawer float and begin processing payments.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
              {/* Left Column: Expected Channel Breakdown */}
              <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-5 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Step 1: Expected Register Totals
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {shiftPreview.shift?.shift_name || `Shift (${user.full_name})`}
                    </h3>
                  </div>
                  <Badge variant={shiftPreview.already_reconciled ? 'success' : 'warning'}>
                    {shiftPreview.already_reconciled ? 'Reconciled' : 'Ready for Close-Out'}
                  </Badge>
                </div>

                {/* Shift Details Banner */}
                <div className="my-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs flex-shrink-0">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Cashier: <strong className="text-slate-900 dark:text-white">{shiftPreview.shift?.user?.full_name || user.full_name}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Shift Started: {shiftPreview.shift ? new Date(shiftPreview.shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'} • {shiftPreview.total_sales} Completed Sales
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Shift Revenue</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {shiftPreview.grand_total.toFixed(2)} ETB
                    </span>
                  </div>
                </div>

                {/* Methods Scrollable List */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                  {shiftPreview.methods.map((method) => {
                    const Icon = getMethodIcon(method.method_code);
                    return (
                      <div
                        key={method.payment_method_id}
                        className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 flex-shrink-0">
                            <Icon className="w-4 h-4 text-[#5345E6] dark:text-indigo-400" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {method.method_name}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {method.transaction_count} transactions • {method.method_code}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {method.expected_amount.toFixed(2)} ETB
                          </span>
                          {method.reference_numbers.length > 0 && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                              Refs: {method.reference_numbers.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Physical Drawer Count & Close-Out Form */}
              <div className="w-full lg:w-[460px] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-5 overflow-hidden flex-shrink-0">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Step 2: Actual Physical Count
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Enter Counted Amounts
                    </h3>
                  </div>
                  <Coins className="w-5 h-5 text-amber-500" />
                </div>

                <form onSubmit={handleSubmitShiftReconciliation} className="flex-1 min-h-0 flex flex-col justify-between pt-3">
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                    <Input
                      label="Opening Drawer Float Cash (ETB)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={shiftOpeningCash}
                      onChange={(e) => setShiftOpeningCash(e.target.value)}
                      helperText="Starting cash balance in drawer"
                    />

                    <div className="space-y-2.5 pt-1">
                      {shiftPreview.methods.map((method) => {
                        const actualVal = shiftEntries[method.payment_method_id]?.actual ?? '';
                        const expected = method.expected_amount;
                        const diff = (parseFloat(actualVal) || 0) - expected;

                        return (
                          <div
                            key={method.payment_method_id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {method.method_name}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                Expected: {expected.toFixed(2)} ETB
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 items-center">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Actual ETB"
                                value={actualVal}
                                onChange={(e) =>
                                  setShiftEntries({
                                    ...shiftEntries,
                                    [method.payment_method_id]: {
                                      ...shiftEntries[method.payment_method_id],
                                      actual: e.target.value,
                                    },
                                  })
                                }
                                required
                              />

                              <div className="text-right">
                                {Math.abs(diff) < 0.01 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Balanced
                                  </span>
                                ) : diff > 0 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100/60 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                                    +{diff.toFixed(2)} Over
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                                    {diff.toFixed(2)} Short
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Input
                      label="Closing Shift Audit Notes (Optional)"
                      placeholder="e.g. Handover to next cashier, 5 ETB discrepancy due to change shortage"
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                    />
                  </div>

                  {/* Pinned Bottom: Discrepancy Total & Submit Button */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 flex-shrink-0">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Shift Discrepancy</span>
                        <span
                          className={`text-base font-black ${
                            Math.abs(shiftDiscrepancy) < 0.01
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : shiftDiscrepancy > 0
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {shiftDiscrepancy >= 0 ? `+${shiftDiscrepancy.toFixed(2)}` : shiftDiscrepancy.toFixed(2)} ETB
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Counted</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {shiftTotalActual.toFixed(2)} ETB
                        </span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={shiftPreview.already_reconciled}
                      isLoading={shiftSubmitting}
                      className="w-full py-3 text-sm font-bold bg-[#5345E6] hover:bg-[#4336D6] text-white rounded-xl shadow-xs"
                    >
                      <CheckCheck className="w-4 h-4 mr-2" />
                      Close Shift & Submit Reconciliation
                    </Button>
                    {shiftPreview.already_reconciled && (
                      <p className="text-[10px] text-center text-slate-400">
                        This shift is already closed and reconciled.
                      </p>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY MASTER CLOSE-OUT (SUPER ADMIN / OWNER)                       */}
      {/* ========================================================================= */}
      {activeTab === 'DAILY_MASTER' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
          {dailyLoading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#5345E6] mr-2" />
              <span className="text-xs font-semibold">Loading daily master rollup...</span>
            </div>
          ) : !dailyPreview ? (
            <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
              <span className="text-xs">No daily data available.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
              {/* Left Column: Master Day Roll-up & Individual Cashier Shifts Breakdown */}
              <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-5 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Owner Daily Audit • {selectedDate}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      All Completed Shifts & Pharmacy Channels
                    </h3>
                  </div>

                  <Badge
                    variant={
                      dailyPreview.existing_status === 'APPROVED'
                        ? 'success'
                        : dailyPreview.existing_status === 'FLAGGED'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {dailyPreview.existing_status || 'Open Daily Draft'}
                  </Badge>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3 pr-1">
                  {/* Individual Cashier Shifts Today */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                        Individual Cashier Shifts Today ({dailyPreview.daily_shifts?.length || 0})
                      </h4>
                      <span className="text-[11px] text-slate-400">Independent register reconciliations</span>
                    </div>

                    {dailyPreview.daily_shifts?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                        No cashier shifts recorded for this date yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dailyPreview.daily_shifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-100 block">
                                  {shift.shift_name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {shift.cashier?.full_name} • Started {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <Badge
                                variant={
                                  shift.reconciliation_status === 'APPROVED'
                                    ? 'success'
                                    : shift.reconciliation_status === 'SUBMITTED'
                                    ? 'info'
                                    : 'warning'
                                }
                                size="xs"
                              >
                                {shift.reconciliation_status}
                              </Badge>
                            </div>

                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">
                                Float: {shift.opening_balance.toFixed(2)} ETB
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                Discrepancy: {shift.discrepancy !== null ? `${shift.discrepancy >= 0 ? '+' : ''}${shift.discrepancy.toFixed(2)} ETB` : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pharmacist Productivity Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                        <UserCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                        Pharmacist Clinical Shift Activity ({dailySummary?.pharmacist_summary?.length || 0})
                      </h4>
                      <span className="text-[11px] text-slate-400">Dispensed medicines & verification volume</span>
                    </div>

                    {dailySummary?.pharmacist_summary?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                        No pharmacist activity recorded for this date.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dailySummary.pharmacist_summary.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 space-y-1.5 text-xs"
                          >
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {p.pharmacist.full_name}
                            </span>
                            <div className="grid grid-cols-3 gap-1 text-[11px] pt-1">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Prescriptions</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.prescriptions_dispensed}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Sales Approved</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.sales_approved}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400 block text-[10px]">Volume</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{p.total_volume.toFixed(2)} ETB</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Channel Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Total Daily Sales by Payment Channel
                    </h4>
                    <div className="space-y-2">
                      {dailyPreview.methods.map((method) => {
                        const Icon = getMethodIcon(method.method_code);
                        return (
                          <div
                            key={method.payment_method_id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2.5">
                              <Icon className="w-4 h-4 text-indigo-500" />
                              <span className="font-bold text-slate-800 dark:text-slate-200">{method.method_name}</span>
                              <span className="text-[10px] text-slate-400">({method.transaction_count} txs)</span>
                            </div>
                            <span className="font-black text-slate-900 dark:text-white">
                              {method.expected_amount.toFixed(2)} ETB
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Owner Master Daily Sign-off Action */}
              <div className="w-full lg:w-[420px] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-5 overflow-hidden flex-shrink-0">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Owner Final Review
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Master Daily Approval
                  </h3>
                </div>

                <div className="flex-1 min-h-0 flex flex-col justify-between pt-3 space-y-4">
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Completed Sales:</span>
                        <strong className="text-slate-900 dark:text-white">{dailyPreview.total_sales}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Cashier Shifts:</span>
                        <strong className="text-slate-900 dark:text-white">{dailyPreview.daily_shifts?.length || 0}</strong>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-sm">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Daily Grand Total:</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">
                          {dailyPreview.grand_total.toFixed(2)} ETB
                        </span>
                      </div>
                    </div>

                    <Input
                      label="Owner Review / Audit Notes"
                      placeholder="e.g. Verified all shifts and end-of-day bank balances"
                      value={dailyNotes}
                      onChange={(e) => setDailyNotes(e.target.value)}
                    />
                  </div>

                  {isAdmin ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
                      <Button
                        onClick={() => handleApproveDailyReconciliation('APPROVED')}
                        disabled={dailyPreview.existing_status === 'APPROVED'}
                        isLoading={dailyApproving}
                        className="w-full py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        {dailyPreview.existing_status === 'APPROVED'
                          ? 'Daily Reconciliation Approved'
                          : 'Approve & Finalize Daily Reconciliation'}
                      </Button>

                      {dailyPreview.existing_status !== 'APPROVED' && (
                        <Button
                          variant="outline"
                          onClick={() => handleApproveDailyReconciliation('FLAGGED')}
                          disabled={dailyApproving}
                          className="w-full py-2 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                        >
                          <Flag className="w-3.5 h-3.5 mr-1" /> Flag Discrepancy for Review
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 text-center font-medium">
                      Master daily reconciliation approval is reserved for the Pharmacy Owner (Admin).
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RECONCILIATION HISTORY & AUDIT LOG                                 */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Filter Scope:</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                {['ALL', 'SHIFT', 'DAILY'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setHistoryTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      historyTypeFilter === t
                        ? 'bg-white dark:bg-slate-700 text-[#5345E6] dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`${API_BASE}/reconciliation/export?date=${selectedDate}`, '_blank');
              }}
              className="text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto mt-2">
            <Table
              isLoading={historyLoading}
              columns={[
                {
                  header: 'Date & Type',
                  accessor: 'reconciliation_date',
                  render: (row) => (
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {new Date(row.reconciliation_date).toLocaleDateString()}
                      </span>
                      <Badge variant={row.reconciliation_type === 'SHIFT' ? 'info' : 'primary'} size="xs">
                        {row.reconciliation_type}
                      </Badge>
                    </div>
                  ),
                },
                {
                  header: 'Staff / Shift',
                  accessor: 'cashier',
                  render: (row) => (
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {row.cashier?.full_name || row.creator?.full_name || 'All'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {row.shift_name || (row.reconciliation_type === 'DAILY' ? 'Master Daily Rollup' : 'Shift')}
                      </span>
                    </div>
                  ),
                },
                {
                  header: 'Expected',
                  accessor: 'total_expected',
                  render: (row) => (
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {parseFloat(row.total_expected).toFixed(2)} ETB
                    </span>
                  ),
                },
                {
                  header: 'Actual',
                  accessor: 'total_actual',
                  render: (row) => (
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {parseFloat(row.total_actual).toFixed(2)} ETB
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
                        className={`font-mono font-bold text-xs ${
                          Math.abs(d) < 0.01
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : d > 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {d >= 0 ? `+${d.toFixed(2)}` : d.toFixed(2)} ETB
                      </span>
                    );
                  },
                },
                {
                  header: 'Status',
                  accessor: 'status',
                  render: (row) => (
                    <Badge
                      variant={
                        row.status === 'APPROVED'
                          ? 'success'
                          : row.status === 'FLAGGED'
                          ? 'danger'
                          : 'warning'
                      }
                      size="xs"
                    >
                      {row.status}
                    </Badge>
                  ),
                },
                {
                  header: 'Actions',
                  accessor: 'actions',
                  render: (row) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailModal(row)}
                      className="text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  ),
                },
              ]}
              data={history}
            />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={Boolean(detailModal)}
        onClose={() => setDetailModal(null)}
        title={`Reconciliation: ${detailModal?.reconciliation_type} (${new Date(detailModal?.reconciliation_date || Date.now()).toLocaleDateString()})`}
        maxWidth="max-w-xl"
      >
        {detailModal && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
              <p><strong>Shift / Scope:</strong> {detailModal.shift_name || detailModal.reconciliation_type}</p>
              <p><strong>Staff:</strong> {detailModal.cashier?.full_name || detailModal.creator?.full_name}</p>
              <p><strong>Status:</strong> {detailModal.status}</p>
              {detailModal.approver && (
                <p><strong>Approved By Owner:</strong> {detailModal.approver.full_name}</p>
              )}
              {detailModal.notes && <p><strong>Audit Notes:</strong> {detailModal.notes}</p>}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {detailModal.entries?.map((entry, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {entry.payment_method?.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {entry.transaction_count} txs
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold block">
                      Actual: {parseFloat(entry.actual_amount).toFixed(2)} ETB
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Expected: {parseFloat(entry.expected_amount).toFixed(2)} ETB
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`${API_BASE}/reconciliation/export?id=${detailModal.id}`, '_blank');
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Download CSV
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
