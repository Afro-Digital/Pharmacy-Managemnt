import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Settings, Palette, CreditCard, Upload, Plus, Trash2, Check } from 'lucide-react';

export const SettingsPage = () => {
  const { t } = useTranslation();
  const { settings, refreshSettings } = useTheme();

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

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {t('settings.title')}
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure pharmacy profile, branding colors, and accepted payment integrations
        </p>
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

      {/* Main Settings Form */}
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

        {/* Theme & Branding */}
        <Card className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-sm text-slate-900">{t('settings.theme_colors')}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
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

      {/* Payment Methods Management */}
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
