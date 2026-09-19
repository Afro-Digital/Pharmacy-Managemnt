import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import {
  Settings,
  Palette,
  CreditCard,
  Plus,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  FileX,
  Flame,
  Lock,
  Layers,
  CheckCircle2,
  RefreshCw,
  PackageX,
  FileText,
} from 'lucide-react';

export const SettingsPage = () => {
  const { t } = useTranslation();
  const { settings, refreshSettings } = useTheme();
  const { user } = useAuth();
  const isAdmin = user && user.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('GENERAL'); // 'GENERAL' | 'PAYMENTS' | 'DANGER'

  const [formData, setFormData] = useState({
    pharmacy_name: '',
    pharmacy_name_am: '',
    phone: '',
    email: '',
    address: '',
    currency: 'ETB',
    default_language: 'en',
    primary_color: '#2563EB',
    secondary_color: '#1E40AF',
  });

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Payment Method Modal
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [newPm, setNewPm] = useState({ name: '', name_am: '', code: '' });

  // Danger Zone State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmPhrase: '',
    endpoint: '',
    isCritical: false,
  });
  const [typedPhrase, setTypedPhrase] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        pharmacy_name: settings.pharmacy_name || '',
        pharmacy_name_am: settings.pharmacy_name_am || '',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || '',
        currency: settings.currency || 'ETB',
        default_language: settings.default_language || 'en',
        primary_color: settings.primary_color || '#2563EB',
        secondary_color: settings.secondary_color || '#1E40AF',
      });
    }
  }, [settings]);

  const fetchPaymentMethods = async () => {
    try {
      const res = await api.get('/payment-methods');
      if (res.data.success) setPaymentMethods(res.data.data);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    }
  };

  const fetchDangerStats = async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    try {
      const res = await api.get('/danger-zone/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load danger zone stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
    if (isAdmin) {
      fetchDangerStats();
    }
  }, [isAdmin]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put('/settings', formData);
      if (res.data.success) {
        setSuccessMessage('Store settings updated successfully');
        refreshSettings();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentMethod = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/payment-methods', newPm);
      if (res.data.success) {
        setSuccessMessage(`Payment method ${newPm.name} added successfully`);
        setPmModalOpen(false);
        setNewPm({ name: '', name_am: '', code: '' });
        fetchPaymentMethods();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to add payment method');
    }
  };

  const handleTogglePaymentMethod = async (pm) => {
    try {
      await api.put(`/payment-methods/${pm.id}`, { is_active: !pm.is_active });
      fetchPaymentMethods();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const openDangerModal = (actionConfig) => {
    setConfirmModal({
      isOpen: true,
      ...actionConfig,
    });
    setTypedPhrase('');
    setAdminPassword('');
    setModalError(null);
  };

  const closeDangerModal = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    setTypedPhrase('');
    setAdminPassword('');
    setModalError(null);
  };

  const handleExecuteDangerAction = async (e) => {
    e.preventDefault();
    if (typedPhrase.trim().toUpperCase() !== confirmModal.confirmPhrase.trim().toUpperCase()) {
      setModalError(`Please type "${confirmModal.confirmPhrase}" exactly to proceed.`);
      return;
    }
    if (!adminPassword) {
      setModalError('Administrator password is required.');
      return;
    }

    setActionLoading(true);
    setModalError(null);

    try {
      const res = await api.post(confirmModal.endpoint, {
        password: adminPassword,
        confirmPhrase: typedPhrase.trim().toUpperCase(),
      });

      if (res.data.success) {
        setSuccessMessage(res.data.message);
        closeDangerModal();
        fetchDangerStats();
      }
    } catch (err) {
      setModalError(err.response?.data?.error?.message || 'Danger zone action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {t('settings.title')}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure pharmacy profile, payment integrations, and system maintenance
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('GENERAL')}
          className={`flex items-center px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'GENERAL'
              ? 'bg-[#5345E6] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5 mr-1.5" />
          General Profile & Colors
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PAYMENTS')}
          className={`flex items-center px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'PAYMENTS'
              ? 'bg-[#5345E6] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 mr-1.5" />
          Payment Methods
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('DANGER')}
            className={`flex items-center px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              activeTab === 'DANGER'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
            Danger Zone
            <span className="ml-1.5 px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded-md">
              Admin
            </span>
          </button>
        )}
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
      {/* TAB 1: General Settings                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'GENERAL' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Pharmacy Profile */}
          <Card className="space-y-4">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              {t('settings.store_profile')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('settings.pharmacy_name')}
                value={formData.pharmacy_name}
                onChange={(e) => setFormData({ ...formData, pharmacy_name: e.target.value })}
              />
              <Input
                label={t('settings.pharmacy_name_am')}
                value={formData.pharmacy_name_am}
                onChange={(e) => setFormData({ ...formData, pharmacy_name_am: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('settings.phone')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input
                label={t('settings.email')}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <Input
              label={t('settings.address')}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </Card>

          {/* Localization */}
          <Card className="space-y-4">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              {t('settings.localization')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('settings.currency')}
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                disabled
              />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {t('settings.default_language')}
                </label>
                <select
                  value={formData.default_language}
                  onChange={(e) => setFormData({ ...formData, default_language: e.target.value })}
                  className="w-full text-xs font-semibold bg-white border border-slate-200/80 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5345E6]/30"
                >
                  <option value="en">English (US)</option>
                  <option value="am">አማርኛ (Amharic)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Branding Colors */}
          <Card className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Palette className="w-4 h-4 text-purple-600" />
              <h4 className="font-bold text-sm text-slate-900">{t('settings.branding')}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  {t('settings.primary_color')}
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  {t('settings.secondary_color')}
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Button type="submit" isLoading={loading} className="px-6 py-2.5 font-bold shadow-sm">
            {t('settings.save_settings')}
          </Button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Payment Methods                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'PAYMENTS' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-sm text-slate-900">{t('settings.payment_methods')}</h4>
            </div>
            <Button size="sm" onClick={() => setPmModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Method
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-slate-900">{pm.name}</span>
                  {pm.name_am && <span className="ml-2 text-xs text-blue-600">({pm.name_am})</span>}
                  <p className="text-xs font-mono text-slate-400">Code: {pm.code}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant={pm.is_active ? 'success' : 'neutral'}>
                    {pm.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                  <button
                    onClick={() => handleTogglePaymentMethod(pm)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {pm.is_active ? 'Deactivate' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Danger Zone (Admin Only)                                          */}
      {/* ========================================================================= */}
      {activeTab === 'DANGER' && isAdmin && (
        <div className="space-y-6">
          {/* Header Warning Banner */}
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-950">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-rose-900">High-Impact Administrator Zone</h4>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Actions in this section are <strong>permanent and destructive</strong>. They immediately wipe database records, reset transactional ledgers, or erase product catalogs. Each action requires your administrator password and exact keyword confirmation.
              </p>
            </div>
          </div>

          {/* Live System Statistics Card */}
          <Card className="bg-slate-50/50 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600">
                  Current Database Entity Counts
                </h4>
              </div>
              <button
                type="button"
                onClick={fetchDangerStats}
                disabled={statsLoading}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center font-medium"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">Products</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {stats ? stats.productsCount : '...'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">Inventory Batches</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {stats ? stats.inventoryCount : '...'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">Completed Sales</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {stats ? stats.salesCount : '...'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">Prescriptions</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {stats ? stats.prescriptionsCount : '...'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">Cashier Shifts</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {stats ? stats.shiftsCount : '...'}
                </span>
              </div>
            </div>
          </Card>

          {/* Action 1: Delete All Products */}
          <Card className="border-rose-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <PackageX className="w-4 h-4 text-rose-600" />
                  <h4 className="font-bold text-sm text-slate-900">Delete All Products & Inventory</h4>
                  <Badge variant="danger">Catalog Wipe</Badge>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Permanently deletes every product, inventory batch, shelf assignment, and inventory transfer record. Used to clean out duplicate test items and start with a fresh catalog.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  openDangerModal({
                    title: 'Delete All Products & Inventory',
                    description:
                      'This will permanently delete ALL product definitions, stock batches in Store & Dispensary, and transfer logs. Categories and sales ledgers will be preserved.',
                    confirmPhrase: 'DELETE ALL PRODUCTS',
                    endpoint: '/danger-zone/delete-all-products',
                    isCritical: true,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 whitespace-nowrap shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete All Products
              </Button>
            </div>
          </Card>

          {/* Action 2: Clear All Sales */}
          <Card className="border-rose-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <FileX className="w-4 h-4 text-rose-600" />
                  <h4 className="font-bold text-sm text-slate-900">Clear All Sales & Transactions</h4>
                  <Badge variant="danger">Ledger Reset</Badge>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Permanently wipes all historical orders, payments, cashier shifts, and daily reconciliations. Useful after testing the system to clear dummy transactions before opening to real customers. Product stock is preserved.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  openDangerModal({
                    title: 'Clear All Sales & Transactions',
                    description:
                      'This will permanently delete all completed sales orders, receipts, payments, cashier work shifts, and reconciliation close-outs. Your product catalog and inventory quantities will remain unchanged.',
                    confirmPhrase: 'CLEAR ALL SALES',
                    endpoint: '/danger-zone/clear-all-sales',
                    isCritical: true,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 whitespace-nowrap shadow-xs"
              >
                <FileX className="w-3.5 h-3.5 mr-1.5" />
                Clear All Sales
              </Button>
            </div>
          </Card>

          {/* Action 3: Reset Inventory to Zero */}
          <Card className="border-amber-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <h4 className="font-bold text-sm text-slate-900">Zero Out All Stock Quantities</h4>
                  <Badge variant="warning">Stock Zeroing</Badge>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Sets the quantity of all inventory batches across STORE and DISPENSARY to 0. Product names, barcodes, batch numbers, and expiry dates are preserved. Perfect for performing a full physical inventory count.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  openDangerModal({
                    title: 'Zero Out All Stock Quantities',
                    description:
                      'This will set quantity = 0 on all inventory batches across the pharmacy. No products or batches will be deleted.',
                    confirmPhrase: 'RESET STOCK TO ZERO',
                    endpoint: '/danger-zone/reset-inventory',
                    isCritical: false,
                  })
                }
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 whitespace-nowrap shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Zero All Stock
              </Button>
            </div>
          </Card>

          {/* Action 4: Clear Prescriptions */}
          <Card className="border-rose-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-rose-600" />
                  <h4 className="font-bold text-sm text-slate-900">Clear All Prescriptions</h4>
                  <Badge variant="danger">Clinical Records</Badge>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Deletes all patient prescriptions, dispensed prescription items, and QR upload sessions.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  openDangerModal({
                    title: 'Clear All Prescriptions',
                    description:
                      'This will permanently delete all prescription records, photo upload sessions, and clinical dispensing histories.',
                    confirmPhrase: 'CLEAR ALL PRESCRIPTIONS',
                    endpoint: '/danger-zone/clear-prescriptions',
                    isCritical: true,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 whitespace-nowrap shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Clear Prescriptions
              </Button>
            </div>
          </Card>

          {/* Action 5: Factory Reset */}
          <Card className="border-red-400 bg-red-50/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-red-700" />
                  <h4 className="font-bold text-sm text-red-950">Complete Factory Reset</h4>
                  <span className="px-2 py-0.5 bg-red-700 text-white font-extrabold text-[10px] rounded-md uppercase">
                    Destructive
                  </span>
                </div>
                <p className="text-xs text-red-800/80 max-w-xl leading-relaxed">
                  Total operational wipe: deletes all products, stock, sales, cashier shifts, reconciliations, and prescriptions. Only Administrator user accounts and fundamental pharmacy settings will remain.
                </p>
              </div>
              <Button
                type="button"
                onClick={() =>
                  openDangerModal({
                    title: 'Complete Factory System Reset',
                    description:
                      'CRITICAL ACTION: This wipes all products, inventory, sales, payments, shifts, and prescriptions. Only your administrator credentials, basic store settings, and categories will be kept.',
                    confirmPhrase: 'FACTORY RESET',
                    endpoint: '/danger-zone/factory-reset',
                    isCritical: true,
                  })
                }
                className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 whitespace-nowrap shadow-sm"
              >
                <Flame className="w-3.5 h-3.5 mr-1.5" />
                Execute Factory Reset
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Danger Zone Two-Factor Authorization Modal                                */}
      {/* ========================================================================= */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={closeDangerModal}
        title={confirmModal.title}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleExecuteDangerAction} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-950">Irreversible Action Warning</p>
              <p className="mt-1 leading-relaxed">{confirmModal.description}</p>
            </div>
          </div>

          {modalError && (
            <Alert variant="error" onClose={() => setModalError(null)}>
              {modalError}
            </Alert>
          )}

          {/* Verification Phrase Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              1. Type confirmation phrase <strong className="font-mono text-rose-700 select-all">"{confirmModal.confirmPhrase}"</strong>:
            </label>
            <Input
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={confirmModal.confirmPhrase}
              required
              autoFocus
              className="font-mono text-xs"
            />
          </div>

          {/* Admin Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              2. Enter your Administrator Account Password:
            </label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={closeDangerModal}
              disabled={actionLoading}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={actionLoading}
              disabled={
                actionLoading ||
                typedPhrase.trim().toUpperCase() !== confirmModal.confirmPhrase.trim().toUpperCase() ||
                !adminPassword
              }
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-5"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Authorize & Execute
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal
        isOpen={pmModalOpen}
        onClose={() => setPmModalOpen(false)}
        title="Add Accepted Payment Method"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreatePaymentMethod} className="space-y-4">
          <Input
            label="Method Name (English)"
            required
            placeholder="e.g. Amole, Sahay"
            value={newPm.name}
            onChange={(e) => setNewPm({ ...newPm, name: e.target.value })}
          />
          <Input
            label="Method Name (Amharic)"
            placeholder="e.g. አሞሌ"
            value={newPm.name_am}
            onChange={(e) => setNewPm({ ...newPm, name_am: e.target.value })}
          />
          <Input
            label="Internal Code"
            required
            placeholder="e.g. AMOLE"
            value={newPm.code}
            onChange={(e) => setNewPm({ ...newPm, code: e.target.value })}
          />
          <Button type="submit" className="w-full py-2.5 font-bold mt-2">
            Save Payment Method
          </Button>
        </form>
      </Modal>
    </div>
  );
};
