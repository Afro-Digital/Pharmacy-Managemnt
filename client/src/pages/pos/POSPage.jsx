import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useCartStore } from '../../stores/cartStore';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Printer,
  CheckCircle2,
  Clock,
  User,
  FileText,
  ShoppingBag,
  Send,
  CreditCard,
  Lock,
  ArrowRight,
  XCircle,
  RefreshCw,
} from 'lucide-react';

export const POSPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pharmacyDisplayName, settings } = useTheme();

  const isPharmacist = user?.role === 'PHARMACIST';
  const isCashier = user?.role === 'CASHIER';
  const isAdmin = user?.role === 'ADMIN';

  // For Admin, allow toggling between Pharmacist Mode and Cashier Mode
  const [adminMode, setAdminMode] = useState('PHARMACIST'); // 'PHARMACIST' or 'CASHIER'
  const activeMode = isCashier ? 'CASHIER' : isPharmacist ? 'PHARMACIST' : adminMode;

  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    discountAmount,
    setDiscountAmount,
    selectedPatient,
    setSelectedPatient,
    selectedPrescription,
    loadPrescription,
    clearCart,
    getSubtotal,
    getTotalAmount,
  } = useCartStore();

  // Search & Catalogs
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [dispensaryInventory, setDispensaryInventory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [patients, setPatients] = useState([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState([]);

  // Cashier Queue State
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedPendingOrder, setSelectedPendingOrder] = useState(null);
  const [cashierPayments, setCashierPayments] = useState([]);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const searchInputRef = useRef(null);

  // Load initial data
  const loadInitialData = async () => {
    try {
      const [invRes, pmRes, patRes, rxRes] = await Promise.all([
        api.get('/inventory/dispensary?limit=100'),
        api.get('/payment-methods?active_only=true'),
        api.get('/patients?limit=50'),
        api.get('/prescriptions?status=PENDING&limit=50'),
      ]);

      if (invRes.data.success) setDispensaryInventory(invRes.data.data);
      if (pmRes.data.success) setPaymentMethods(pmRes.data.data);
      if (patRes.data.success) setPatients(patRes.data.data);
      if (rxRes.data.success) setPendingPrescriptions(rxRes.data.data);
    } catch (err) {
      console.error('Failed to load initial POS data:', err);
    }
  };

  // Load pending orders queue for Cashier
  const fetchPendingOrders = async () => {
    try {
      setQueueLoading(true);
      const res = await api.get('/sales?status=PENDING_PAYMENT&limit=50');
      if (res.data.success) {
        setPendingOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load pending sales:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeMode === 'CASHIER') {
      fetchPendingOrders();
    }
  }, [activeMode]);

  // Debounced product search for Pharmacist
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await api.get(`/products/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.data.success) {
          setSearchResults(res.data.data);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    };

    const debounce = setTimeout(performSearch, 200);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Pharmacist: Select product
  const handleProductSelect = (product) => {
    const batch = dispensaryInventory.find(
      (inv) => inv.product_id === product.id && inv.quantity > 0
    );

    if (!batch) {
      setErrorMessage(`No stock available in Dispensary for ${product.name}`);
      return;
    }

    const added = addItem(product, batch);
    if (!added) {
      setErrorMessage(`Cannot add more than available dispensary stock (${batch.quantity})`);
    } else {
      setErrorMessage(null);
      setSearchQuery('');
      setSearchResults([]);
      searchInputRef.current?.focus();
    }
  };

  // Pharmacist: Link prescription
  const handlePrescriptionSelect = (e) => {
    const rxId = e.target.value;
    if (!rxId) return;
    const rx = pendingPrescriptions.find((p) => p.id === rxId);
    if (rx) {
      loadPrescription(rx, dispensaryInventory);
    }
  };

  // Pharmacist: Approve & Send to Cashier
  const handleApproveAndSend = async () => {
    if (items.length === 0) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          batch_number: i.batch?.batch_number,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount || 0,
          total_price: i.total_price,
        })),
        prescription_id: selectedPrescription?.id || null,
        patient_id: selectedPatient?.id || null,
        discount_amount: discountAmount,
        sale_type: selectedPrescription ? 'PRESCRIPTION' : 'WALK_IN',
        notes: `Approved by ${user.full_name}`,
      };

      const res = await api.post('/sales', payload);
      if (res.data.success) {
        setSuccessMessage(`Order #${res.data.data.sale_number} approved and sent to Cashier counter!`);
        clearCart();

        // Refresh dispensary stock
        const invRes = await api.get('/inventory/dispensary?limit=100');
        if (invRes.data.success) setDispensaryInventory(invRes.data.data);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to approve and forward order');
    } finally {
      setLoading(false);
    }
  };

  // Cashier: Select pending order from queue
  const handleSelectPendingOrder = (order) => {
    setSelectedPendingOrder(order);
    const defaultMethod = paymentMethods.find((m) => m.code === 'CASH') || paymentMethods[0];
    setCashierPayments([
      {
        payment_method_id: defaultMethod?.id || '',
        amount: parseFloat(order.total_amount),
        reference_number: '',
      },
    ]);
  };

  const addCashierPaymentSplit = () => {
    if (!selectedPendingOrder) return;
    const currentPaid = cashierPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const totalDue = parseFloat(selectedPendingOrder.total_amount);
    const remaining = Math.max(0, parseFloat((totalDue - currentPaid).toFixed(2)));

    // Pick first unused payment method
    const usedMethodIds = new Set(cashierPayments.map((p) => p.payment_method_id));
    const nextUnusedMethod = paymentMethods.find((m) => !usedMethodIds.has(m.id)) || paymentMethods[0];

    setCashierPayments([
      ...cashierPayments,
      {
        payment_method_id: nextUnusedMethod?.id || '',
        amount: remaining > 0 ? remaining : '',
        reference_number: '',
      },
    ]);
  };

  const updateCashierPaymentRow = (idx, field, val) => {
    const updated = [...cashierPayments];
    updated[idx] = { ...updated[idx], [field]: val };
    setCashierPayments(updated);
  };

  const removeCashierPaymentRow = (idx) => {
    setCashierPayments(cashierPayments.filter((_, i) => i !== idx));
  };

  // Cashier: Confirm payment & print receipt
  const handleConfirmPayment = async () => {
    if (!selectedPendingOrder) return;

    // Check duplicate payment methods
    const methodIds = cashierPayments.map((p) => p.payment_method_id).filter(Boolean);
    if (new Set(methodIds).size !== methodIds.length) {
      setErrorMessage('Duplicate payment method detected. Each split payment must use a different payment method.');
      return;
    }

    const paidSum = cashierPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const totalDue = parseFloat(selectedPendingOrder.total_amount);

    if (paidSum < totalDue - 0.01) {
      setErrorMessage(`Payments total (${paidSum.toFixed(2)} ETB) is less than the required amount (${totalDue.toFixed(2)} ETB). Remaining balance: ${(totalDue - paidSum).toFixed(2)} ETB.`);
      return;
    }

    if (paidSum > totalDue + 0.01) {
      setErrorMessage(`Payments total (${paidSum.toFixed(2)} ETB) exceeds the required order amount (${totalDue.toFixed(2)} ETB) by ${(paidSum - totalDue).toFixed(2)} ETB.`);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.post(`/sales/${selectedPendingOrder.id}/pay`, {
        payments: cashierPayments.map((p) => ({
          payment_method_id: p.payment_method_id,
          amount: parseFloat(p.amount),
          reference_number: p.reference_number || undefined,
        })),
      });

      if (res.data.success) {
        setCompletedSale(res.data.data);
        setSelectedPendingOrder(null);
        setCashierPayments([]);
        setSuccessMessage(`Payment confirmed for sale #${res.data.data.sale_number}!`);
        fetchPendingOrders();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Payment confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  // Cashier or Pharmacist: Cancel order
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Cancel this pending order and return reserved products to Dispensary?')) return;
    try {
      const res = await api.post(`/sales/${orderId}/cancel`, { reason: 'Customer declined at checkout' });
      if (res.data.success) {
        setSuccessMessage('Order cancelled and dispensary inventory restored');
        if (selectedPendingOrder?.id === orderId) {
          setSelectedPendingOrder(null);
        }
        fetchPendingOrders();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to cancel order');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Bar with Mode Indicator & Admin Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#4336D6] to-[#5345E6] flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {t('pos.title')}
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {activeMode === 'PHARMACIST'
                ? 'Pharmacist Station • Select, configure & approve medicines'
                : 'Cashier Station • Confirm payments & issue printed receipts'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {isAdmin && (
            <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200/50 text-xs font-semibold">
              <button
                onClick={() => setAdminMode('PHARMACIST')}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  adminMode === 'PHARMACIST'
                    ? 'bg-white text-[#5345E6] shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Pharmacist Mode
              </button>
              <button
                onClick={() => setAdminMode('CASHIER')}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  adminMode === 'CASHIER'
                    ? 'bg-white text-[#5345E6] shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Cashier Queue Mode
              </button>
            </div>
          )}

          {activeMode === 'CASHIER' && (
            <Button variant="secondary" size="sm" pill onClick={fetchPendingOrders} isLoading={queueLoading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Queue
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* ========================================================================= */}
      {/* PHARMACIST WORKFLOW: Select Products, Configure & Approve Sale           */}
      {/* ========================================================================= */}
      {activeMode === 'PHARMACIST' && (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)]">
          {/* Left Column: Product Search & Dispensary Grid */}
          <div className="flex-1 flex flex-col space-y-3 min-w-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('pos.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 text-xs font-medium bg-white rounded-full border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#5345E6]/15 focus:border-[#5345E6] transition-all"
              />
            </div>

            {/* Live Search Results Overlay */}
            {searchResults.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-2 max-h-64 overflow-y-auto space-y-1 z-20">
                {searchResults.map((product) => {
                  const stock = dispensaryInventory
                    .filter((inv) => inv.product_id === product.id)
                    .reduce((s, inv) => s + inv.quantity, 0);

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                        stock > 0 ? 'hover:bg-blue-50/70' : 'opacity-50 cursor-not-allowed bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{product.name}</div>
                        <div className="text-xs text-slate-400">
                          {product.generic_name || product.brand} • {product.strength || product.dosage_form || 'Unit'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 text-sm">
                          {parseFloat(product.unit_price).toFixed(2)} ETB
                        </span>
                        <div className="text-xs">
                          {stock > 0 ? (
                            <span className="text-emerald-600 font-medium">{stock} {t('pos.in_stock')}</span>
                          ) : (
                            <span className="text-rose-500 font-medium">{t('pos.out_of_stock')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dispensary Grid */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dispensary Inventory Available for Approval ({dispensaryInventory.length})
                </h4>
                <Badge variant="info">Step 1: Pharmacist Approval</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {dispensaryInventory.filter((inv) => inv.quantity > 0).map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => handleProductSelect(inv.product)}
                    className="p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/70 hover:border-blue-300 rounded-xl transition-all cursor-pointer flex flex-col justify-between group shadow-2xs"
                  >
                    <div>
                      <Badge variant={inv.product.product_type === 'MEDICINE' ? 'info' : 'warning'} size="xs" className="mb-1">
                        {inv.product.product_type}
                      </Badge>
                      <h5 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-2">
                        {inv.product.name}
                      </h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Batch: {inv.batch_number || 'GEN'}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/50">
                      <span className="text-xs font-bold text-slate-800">
                        {parseFloat(inv.product.unit_price).toFixed(2)} ETB
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Qty: {inv.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Pharmacist Order Assembly Cart */}
          <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center">
                  {t('pos.cart')} ({items.length})
                </h3>
                {items.length > 0 && (
                  <button onClick={clearCart} className="text-xs text-rose-600 hover:text-rose-700 font-medium">
                    Clear
                  </button>
                )}
              </div>

              {/* Prescription link dropdown */}
              <select
                onChange={handlePrescriptionSelect}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
              >
                <option value="">{t('pos.no_prescription')}</option>
                {pendingPrescriptions.map((rx) => (
                  <option key={rx.id} value={rx.id}>
                    Rx: {rx.prescription_no} ({rx.patient?.full_name})
                  </option>
                ))}
              </select>

              {/* Patient select */}
              <select
                value={selectedPatient?.id || ''}
                onChange={(e) => {
                  const p = patients.find((pat) => pat.id === e.target.value);
                  setSelectedPatient(p || null);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
              >
                <option value="">{t('pos.walk_in_customer')}</option>
                {patients.map((pat) => (
                  <option key={pat.id} value={pat.id}>
                    {pat.full_name} ({pat.phone || 'No phone'})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 p-4 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                  <ShoppingBag className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                  <p className="text-xs">{t('pos.empty_cart')}</p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div className="flex-1 pr-3">
                      <h5 className="text-xs font-semibold text-slate-800 line-clamp-1">
                        {item.product.name}
                      </h5>
                      <span className="text-[11px] text-slate-400">
                        {item.unit_price.toFixed(2)} ETB each
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="p-1 hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-semibold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="p-1 hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-bold text-slate-900 w-16 text-right">
                        {item.total_price.toFixed(2)} ETB
                      </span>

                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pharmacist Action Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{t('pos.subtotal')}</span>
                <span className="font-semibold text-slate-800">{getSubtotal().toFixed(2)} ETB</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{t('pos.discount')}</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-20 px-2 py-0.5 text-right text-xs bg-white border border-slate-200 rounded focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-bold text-slate-900">{t('pos.total')}</span>
                  <p className="text-[10px] text-slate-400 font-medium">{t('pos.tax_note')}</p>
                </div>
                <span className="text-xl font-extrabold text-blue-600">
                  {getTotalAmount().toFixed(2)} ETB
                </span>
              </div>

              <Button
                onClick={handleApproveAndSend}
                disabled={items.length === 0}
                isLoading={loading}
                className="w-full py-3 text-sm font-bold shadow-md bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {t('pos.approve_and_send')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASHIER WORKFLOW: Pending Orders Queue & Payment Confirmation            */}
      {/* ========================================================================= */}
      {activeMode === 'CASHIER' && (() => {
        const totalDue = selectedPendingOrder ? parseFloat(selectedPendingOrder.total_amount) : 0;
        const totalPaid = cashierPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const remainingBalance = totalDue - totalPaid;
        const isOverpaid = totalPaid > totalDue + 0.01;
        const isUnderpaid = totalPaid < totalDue - 0.01;
        const isExactMatch = !isOverpaid && !isUnderpaid;

        const usedMethodIds = cashierPayments.map((p) => p.payment_method_id).filter(Boolean);
        const hasDuplicateMethod = new Set(usedMethodIds).size !== usedMethodIds.length;
        const hasInvalidRow = cashierPayments.some(
          (p) => !p.payment_method_id || !p.amount || parseFloat(p.amount) <= 0
        );
        const canConfirm = selectedPendingOrder && isExactMatch && !hasDuplicateMethod && !hasInvalidRow;

        return (
          <div className="max-w-6xl mx-auto w-full flex flex-col lg:flex-row gap-5 h-[calc(100vh-9.5rem)]">
            {/* Left Column: Pending Orders Queue */}
            <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm p-5 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3 flex-shrink-0">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-amber-500" />
                    {t('pos.pending_orders')} ({pendingOrders.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pharmacist-approved orders waiting for customer payment
                  </p>
                </div>
                <Badge variant="warning">{t('pos.awaiting_payment')}</Badge>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
                {pendingOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
                    <Clock className="w-12 h-12 mb-3 stroke-1 text-slate-300 animate-pulse" />
                    <p className="text-sm font-semibold text-slate-700">No pending orders in queue</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Orders approved by the clinical pharmacist will automatically appear here for payment.
                    </p>
                  </div>
                ) : (
                  pendingOrders.map((order) => {
                    const isSelected = selectedPendingOrder?.id === order.id;
                    return (
                      <div
                        key={order.id}
                        onClick={() => handleSelectPendingOrder(order)}
                        className={`p-3.5 my-1.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#F0EEFA] border-[#5345E6] shadow-xs'
                            : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-100'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs text-[#5345E6] bg-white px-2 py-0.5 rounded-lg border border-purple-200">
                              {order.sale_number}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {order.patient?.full_name || t('pos.walk_in_customer')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Approved by: <span className="font-semibold text-slate-700">{order.pharmacist?.full_name || 'Pharmacist'}</span> • {order.items?.length || 0} medications
                          </p>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <span className="text-base font-black text-slate-900">
                              {parseFloat(order.total_amount).toFixed(2)} ETB
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-[#5345E6]' : 'text-slate-300'}`} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Read-Only Order Review & Cashier Split Payment Form */}
            <div className="w-full lg:w-[450px] flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
              {!selectedPendingOrder ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                  <CreditCard className="w-12 h-12 mb-3 stroke-1 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Select an Order from Queue</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Choose a pending order from the left to view customer items, configure split payments, and confirm receipt.
                  </p>
                </div>
              ) : (
                <>
                  {/* Pinned Top: Order Header */}
                  <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-slate-900">
                          {selectedPendingOrder.sale_number}
                        </span>
                        <div className="flex items-center text-[10px] font-semibold text-[#5345E6] bg-purple-50 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3 mr-1" /> Products Locked
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(selectedPendingOrder.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                      >
                        {t('pos.cancel_order')}
                      </button>
                    </div>
                  </div>

                  {/* Compact Read-Only Items List */}
                  <div className="px-3.5 py-2 border-b border-slate-100 max-h-28 overflow-y-auto space-y-1 bg-white flex-shrink-0">
                    {selectedPendingOrder.items?.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <div className="truncate pr-2">
                          <span className="font-semibold text-slate-800 truncate block">{item.product?.name}</span>
                          <span className="text-slate-400 text-[10px]">Batch: {item.batch_number || 'GEN'}</span>
                        </div>
                        <span className="font-mono text-slate-700 whitespace-nowrap text-[11px]">
                          {item.quantity} × {parseFloat(item.unit_price).toFixed(2)} = {parseFloat(item.total_price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price & Balance Countdown Banner */}
                  <div className="p-3.5 bg-[#F8F9FD] border-b border-slate-100 flex-shrink-0 space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Due</span>
                        <span className="text-xl font-black text-slate-900">
                          {totalDue.toFixed(2)} ETB
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Allocated</span>
                        <span className="text-base font-bold text-slate-700">
                          {totalPaid.toFixed(2)} ETB
                        </span>
                      </div>
                    </div>

                    {/* Status Pill Badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                      <span className="font-medium text-slate-500">Balance Status:</span>
                      {isExactMatch ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Exact Match ({totalDue.toFixed(2)} ETB)
                        </span>
                      ) : isUnderpaid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          Remaining: {remainingBalance.toFixed(2)} ETB
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          Exceeds by {(totalPaid - totalDue).toFixed(2)} ETB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Real-time Warning Alerts */}
                  {hasDuplicateMethod && (
                    <div className="mx-3.5 mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2 flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Duplicate Payment Method:</strong> Each split payment must use a distinct method (e.g. Cash + Telebirr, not Cash twice).
                      </span>
                    </div>
                  )}

                  {isOverpaid && (
                    <div className="mx-3.5 mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2 flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Amount Exceeds Total:</strong> The entered split amounts exceed the required total by {(totalPaid - totalDue).toFixed(2)} ETB.
                      </span>
                    </div>
                  )}

                  {/* Middle Scrollable: Split Payment Rows */}
                  <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {t('pos.payment_breakdown')} ({cashierPayments.length})
                      </label>
                      <button
                        type="button"
                        onClick={addCashierPaymentSplit}
                        className="text-xs text-[#5345E6] hover:text-[#4336D6] font-bold flex items-center"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Split Payment
                      </button>
                    </div>

                    {cashierPayments.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 text-[11px]">
                            Payment Split #{idx + 1}
                          </span>
                          {cashierPayments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCashierPaymentRow(idx)}
                              className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={p.payment_method_id}
                            onChange={(e) => updateCashierPaymentRow(idx, 'payment_method_id', e.target.value)}
                            options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={p.amount}
                            onChange={(e) => updateCashierPaymentRow(idx, 'amount', e.target.value)}
                            placeholder="ETB Amount"
                          />
                        </div>

                        <Input
                          placeholder="Transaction / Reference # (Optional)"
                          value={p.reference_number || ''}
                          onChange={(e) => updateCashierPaymentRow(idx, 'reference_number', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Pinned Bottom: Confirm Payment Button (Always Visible) */}
                  <div className="p-3.5 bg-white border-t border-slate-100 flex-shrink-0">
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={!canConfirm}
                      isLoading={loading}
                      className="w-full py-3 text-sm font-bold shadow-xs bg-[#5345E6] hover:bg-[#4336D6] disabled:opacity-50 text-white rounded-xl"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm Payment & Print Receipt
                    </Button>
                    {!canConfirm && (
                      <p className="text-[11px] text-slate-400 text-center mt-1.5 font-medium">
                        {hasDuplicateMethod
                          ? 'Resolve duplicate payment methods to continue'
                          : isUnderpaid
                          ? `Collect remaining ${remainingBalance.toFixed(2)} ETB to confirm`
                          : isOverpaid
                          ? 'Adjust split amounts to match order total'
                          : 'Ensure all split amounts are entered'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Printable Receipt Modal */}
      <Modal
        isOpen={Boolean(completedSale)}
        onClose={() => setCompletedSale(null)}
        title={t('pos.sale_complete')}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div id="printable-receipt" className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs space-y-3">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h4 className="font-bold text-sm text-slate-900">{pharmacyDisplayName}</h4>
              <p className="text-[11px] text-slate-500">{settings?.address || 'Addis Ababa, Ethiopia'}</p>
              <p className="text-[11px] text-slate-500">{settings?.phone}</p>
              <div className="mt-1 font-bold text-slate-800">
                Receipt: {completedSale?.sale_number}
              </div>
              <div className="text-[10px] text-slate-400">
                {new Date(completedSale?.created_at || Date.now()).toLocaleString('en-GB')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Approved by: {completedSale?.pharmacist?.full_name || 'Pharmacist'} • Cashier: {completedSale?.cashier?.full_name || 'Cashier'}
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
              {completedSale?.items?.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span>{item.product?.name || 'Item'} x{item.quantity}</span>
                  <span>{parseFloat(item.total_price).toFixed(2)} ETB</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 font-semibold">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{parseFloat(completedSale?.subtotal || 0).toFixed(2)} ETB</span>
              </div>
              {parseFloat(completedSale?.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{parseFloat(completedSale?.discount_amount || 0).toFixed(2)} ETB</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>TOTAL:</span>
                <span>{parseFloat(completedSale?.total_amount || 0).toFixed(2)} ETB</span>
              </div>
            </div>

            {/* Payment methods breakdown */}
            <div className="pt-2 border-t border-dashed border-slate-300 text-[11px] text-slate-500">
              <span className="font-semibold block text-slate-700">Payment Breakdown:</span>
              {completedSale?.payments?.map((pm, i) => (
                <div key={i} className="flex justify-between">
                  <span>{pm.payment_method?.name || 'Payment'}:</span>
                  <span>{parseFloat(pm.amount).toFixed(2)} ETB</span>
                </div>
              ))}
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-400">
              Thank you for visiting {pharmacyDisplayName}!
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button variant="outline" onClick={printReceipt} className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              {t('pos.print_receipt')}
            </Button>
            <Button onClick={() => setCompletedSale(null)} className="flex-1">
              {t('pos.new_transaction')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
