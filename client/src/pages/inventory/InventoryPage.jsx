import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';
import {
  Boxes,
  Package,
  ArrowRightLeft,
  Plus,
  Edit,
  AlertTriangle,
  Calendar,
  Filter,
  Warehouse,
  Store,
  CheckCircle,
  Layers,
  Trash2,
} from 'lucide-react';

export const InventoryPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('STORE'); // 'STORE', 'DISPENSARY', 'TRANSFERS'
  const [inventoryList, setInventoryList] = useState([]);
  const [transfersList, setTransfersList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');

  // Modals
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [bulkReceiveModalOpen, setBulkReceiveModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState(null);

  // Bulk Receive State (Admin)
  const [bulkItems, setBulkItems] = useState([
    { product_id: '', batch_number: '', expiry_date: '', quantity: '', shelf_location: '', supplier_name: '', notes: '' },
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Receive Form
  const [receiveForm, setReceiveForm] = useState({
    product_id: '',
    batch_number: '',
    expiry_date: '',
    quantity: '',
    shelf_location: '',
    supplier_name: '',
    notes: '',
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    product_id: '',
    batch_number: '',
    from_location: 'STORE',
    to_location: 'DISPENSARY',
    quantity: '',
    notes: '',
  });
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Adjust Form
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustExpiry, setAdjustExpiry] = useState('');
  const [adjustBatch, setAdjustBatch] = useState('');

  // Auto-resolve batches for inventory transfer
  useEffect(() => {
    if (!transferForm.product_id) {
      setAvailableBatches([]);
      return;
    }

    const fetchBatches = async () => {
      setLoadingBatches(true);
      try {
        const res = await api.get('/inventory/batches', {
          params: {
            product_id: transferForm.product_id,
            location: transferForm.from_location,
          },
        });
        if (res.data.success) {
          const batches = res.data.data;
          setAvailableBatches(batches);
          if (batches.length === 1) {
            // Auto-select single batch
            setTransferForm((prev) => ({
              ...prev,
              batch_number: batches[0].batch_number || '',
            }));
          } else {
            // Multiple batches: prompt user by clearing or keeping selection if valid
            setTransferForm((prev) => ({
              ...prev,
              batch_number: '',
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      } finally {
        setLoadingBatches(false);
      }
    };

    fetchBatches();
  }, [transferForm.product_id, transferForm.from_location]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      if (activeTab === 'TRANSFERS') {
        const res = await api.get('/inventory/transfers?limit=50');
        if (res.data.success) setTransfersList(res.data.data);
      } else {
        const queryParams = new URLSearchParams({
          location: activeTab,
          limit: '100',
        });
        if (searchQuery) queryParams.append('search', searchQuery);
        if (expiryFilter) queryParams.append('expiry_status', expiryFilter);

        const res = await api.get(`/inventory?${queryParams.toString()}`);
        if (res.data.success) setInventoryList(res.data.data);
      }
    } catch (err) {
      console.error('Inventory load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [activeTab, searchQuery, expiryFilter]);

  // Load products list for dropdowns
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/products?limit=100');
        if (res.data.success) setProductsList(res.data.data);
      } catch (err) {
        console.error('Products load error:', err);
      }
    };
    loadProducts();
  }, []);

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/inventory', receiveForm);
      if (res.data.success) {
        setSuccessMessage('Stock received into Store successfully');
        setReceiveModalOpen(false);
        setReceiveForm({
          product_id: '',
          batch_number: '',
          expiry_date: '',
          quantity: '',
          shelf_location: '',
          supplier_name: '',
          notes: '',
        });
        fetchInventory();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to receive stock');
    }
  };

  const handleAddBulkRow = () => {
    setBulkItems((prev) => [
      ...prev,
      { product_id: '', batch_number: '', expiry_date: '', quantity: '', shelf_location: '', supplier_name: '', notes: '' },
    ]);
  };

  const handleUpdateBulkRow = (idx, field, val) => {
    setBulkItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleRemoveBulkRow = (idx) => {
    if (bulkItems.length === 1) return;
    setBulkItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleBulkReceiveSubmit = async (e) => {
    e.preventDefault();
    const validItems = bulkItems.filter((i) => i.product_id && parseInt(i.quantity) > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please select a product and enter a quantity greater than 0 for at least one item');
      return;
    }

    setBulkSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/inventory/bulk-receive', { items: validItems });
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        setBulkReceiveModalOpen(false);
        setBulkItems([
          { product_id: '', batch_number: '', expiry_date: '', quantity: '', shelf_location: '', supplier_name: '', notes: '' },
        ]);
        fetchInventory();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to bulk receive stock');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleTransferStock = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/inventory/transfer', transferForm);
      if (res.data.success) {
        setSuccessMessage('Stock transferred to Dispensary successfully');
        setTransferModalOpen(false);
        setTransferForm({
          product_id: '',
          batch_number: '',
          from_location: 'STORE',
          to_location: 'DISPENSARY',
          quantity: '',
          notes: '',
        });
        fetchInventory();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Transfer failed');
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;
    try {
      const res = await api.put(`/inventory/${selectedItemForAdjust.id}`, {
        quantity: adjustQty,
        expiry_date: adjustExpiry || null,
        batch_number: adjustBatch || null,
        reason: adjustReason || 'Expiration date / stock update',
      });
      if (res.data.success) {
        setSuccessMessage('Inventory details and expiration date updated successfully');
        setAdjustModalOpen(false);
        setSelectedItemForAdjust(null);
        setAdjustQty('');
        setAdjustExpiry('');
        setAdjustBatch('');
        setAdjustReason('');
        fetchInventory();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Adjustment failed');
    }
  };

  const getExpiryBadge = (expiryDate) => {
    if (!expiryDate) return <Badge variant="neutral">N/A</Badge>;
    const exp = new Date(expiryDate);
    const today = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(today.getDate() + 30);

    if (exp < today) return <Badge variant="danger">{t('inventory.expired')}</Badge>;
    if (exp <= thirtyDays) return <Badge variant="warning">{t('inventory.expiring_soon')}</Badge>;
    return <Badge variant="success">{t('inventory.normal')}</Badge>;
  };

  const inventoryColumns = [
    {
      header: t('inventory.product'),
      accessor: 'product',
      render: (row) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 flex-shrink-0">
            {row.product?.product_type === 'COSMETIC' ? (
              <Package className="w-4 h-4 text-purple-600" />
            ) : (
              <Boxes className="w-4 h-4 text-[#5345E6]" />
            )}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">{row.product?.name}</div>
            <div className="text-[11px] text-slate-400 font-medium">
              {row.product?.generic_name || row.product?.brand || 'Pharmaceutical Product'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: t('inventory.batch'),
      accessor: 'batch_number',
      render: (row) => <span className="font-mono text-xs text-slate-600">{row.batch_number || 'N/A'}</span>,
    },
    {
      header: t('inventory.qty'),
      accessor: 'quantity',
      render: (row) => (
        <span className="font-bold text-slate-900 text-sm">{row.quantity}</span>
      ),
    },
    {
      header: t('inventory.shelf'),
      accessor: 'shelf_location',
      render: (row) => row.shelf_location || '—',
    },
    {
      header: t('inventory.expiry'),
      accessor: 'expiry_date',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600">
            {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('en-GB') : 'No expiry'}
          </span>
          {getExpiryBadge(row.expiry_date)}
        </div>
      ),
    },
    {
      header: t('inventory.actions'),
      accessor: 'actions',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedItemForAdjust(row);
            setAdjustQty(row.quantity);
            setAdjustBatch(row.batch_number || '');
            setAdjustExpiry(row.expiry_date ? new Date(row.expiry_date).toISOString().split('T')[0] : '');
            setAdjustReason('');
            setAdjustModalOpen(true);
          }}
        >
          <Edit className="w-3.5 h-3.5 mr-1" />
          {t('inventory.adjust')}
        </Button>
      ),
    },
  ];

  const transferColumns = [
    {
      header: 'Date',
      accessor: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleString('en-GB'),
    },
    {
      header: 'Product',
      accessor: 'product',
      render: (row) => row.product?.name,
    },
    {
      header: 'Batch',
      accessor: 'batch_number',
      render: (row) => row.batch_number || '—',
    },
    {
      header: 'Movement',
      accessor: 'movement',
      render: (row) => (
        <div className="flex items-center space-x-1.5 font-semibold text-xs text-blue-700">
          <span>{row.from_location}</span>
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>{row.to_location}</span>
        </div>
      ),
    },
    {
      header: 'Qty Transferred',
      accessor: 'quantity',
      render: (row) => <span className="font-bold text-slate-900">{row.quantity}</span>,
    },
    {
      header: 'Transferred By',
      accessor: 'user',
      render: (row) => row.user?.full_name,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('inventory.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage bulk Store inventory, retail Dispensary counter, and stock movements
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setBulkReceiveModalOpen(true)}
              className="text-xs font-bold px-4 py-2.5 shadow-2xs border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <Layers className="w-4 h-4 mr-1.5 text-[#5345E6]" />
              Bulk Receive
            </Button>
          )}
          <Button
            onClick={() => setReceiveModalOpen(true)}
            className="text-xs font-bold px-4 py-2.5 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('inventory.add_stock')}
          </Button>
          <Button
            onClick={() => setTransferModalOpen(true)}
            variant="secondary"
            className="text-xs font-bold px-4 py-2.5"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            {t('inventory.transfer_stock')}
          </Button>
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

      {/* SellMate Styled Segmented Control Tabs */}
      <div className="flex items-center">
        <div className="inline-flex p-1 bg-slate-100 rounded-full border border-slate-200/50">
          <button
            onClick={() => setActiveTab('STORE')}
            className={`flex items-center px-4 py-2 text-xs font-bold rounded-full transition-all ${
              activeTab === 'STORE'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5 mr-1.5" />
            {t('inventory.store_tab')}
          </button>
          <button
            onClick={() => setActiveTab('DISPENSARY')}
            className={`flex items-center px-4 py-2 text-xs font-bold rounded-full transition-all ${
              activeTab === 'DISPENSARY'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 mr-1.5" />
            {t('inventory.dispensary_tab')}
          </button>
          <button
            onClick={() => setActiveTab('TRANSFERS')}
            className={`flex items-center px-4 py-2 text-xs font-bold rounded-full transition-all ${
              activeTab === 'TRANSFERS'
                ? 'bg-white text-[#5345E6] shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
            {t('inventory.transfers_tab')}
          </button>
        </div>
      </div>

      {/* Filter Row (only for Store/Dispensary) */}
      {activeTab !== 'TRANSFERS' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by product name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              placeholder="All Expiry Statuses"
              options={[
                { value: 'expired', label: 'Expired Items' },
                { value: 'expiring_soon', label: 'Expiring Within 30 Days' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Main Table */}
      {activeTab === 'TRANSFERS' ? (
        <Table columns={transferColumns} data={transfersList} isLoading={loading} />
      ) : (
        <Table columns={inventoryColumns} data={inventoryList} isLoading={loading} />
      )}

      {/* Receive Stock Modal (Adds to Store) */}
      <Modal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        title={t('inventory.add_stock')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleReceiveStock} className="space-y-4">
          <Select
            label="Product"
            required
            value={receiveForm.product_id}
            onChange={(e) => setReceiveForm({ ...receiveForm, product_id: e.target.value })}
            placeholder="Select a product"
            options={productsList.map((p) => ({ value: p.id, label: `${p.name} (${p.product_type})` }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batch Number"
              placeholder="e.g. BATCH-001"
              value={receiveForm.batch_number}
              onChange={(e) => setReceiveForm({ ...receiveForm, batch_number: e.target.value })}
            />
            <Input
              label="Quantity"
              type="number"
              required
              min="1"
              value={receiveForm.quantity}
              onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expiry Date"
              type="date"
              value={receiveForm.expiry_date}
              onChange={(e) => setReceiveForm({ ...receiveForm, expiry_date: e.target.value })}
            />
            <Input
              label="Shelf Location"
              placeholder="e.g. A1, Shelf 3"
              value={receiveForm.shelf_location}
              onChange={(e) => setReceiveForm({ ...receiveForm, shelf_location: e.target.value })}
            />
          </div>
          <Input
            label="Supplier Name"
            placeholder="e.g. Ethiopian Pharmaceuticals"
            value={receiveForm.supplier_name}
            onChange={(e) => setReceiveForm({ ...receiveForm, supplier_name: e.target.value })}
          />
          <Input
            label="Notes"
            placeholder="Optional comments..."
            value={receiveForm.notes}
            onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
          />
          <Button type="submit" className="w-full py-2.5 font-semibold mt-2">
            Confirm & Add to Store
          </Button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* Bulk Receive Stock Modal (Admin Only)                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={bulkReceiveModalOpen}
        onClose={() => setBulkReceiveModalOpen(false)}
        title="Bulk Receive Stock (Admin)"
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleBulkReceiveSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Receive multiple products and batches into Store warehouse simultaneously.
          </p>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {bulkItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">
                    Item #{idx + 1}
                  </span>
                  {bulkItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBulkRow(idx)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Select
                      label="Product"
                      required
                      value={item.product_id}
                      onChange={(e) => handleUpdateBulkRow(idx, 'product_id', e.target.value)}
                      placeholder="Select Product..."
                      options={productsList.map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.dosage_form || p.strength || 'Unit'})`,
                      }))}
                    />
                  </div>
                  <div>
                    <Input
                      label="Quantity"
                      type="number"
                      required
                      min="1"
                      placeholder="Units"
                      value={item.quantity}
                      onChange={(e) => handleUpdateBulkRow(idx, 'quantity', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Input
                      label="Batch Number"
                      placeholder="e.g. BATCH-01"
                      value={item.batch_number}
                      onChange={(e) => handleUpdateBulkRow(idx, 'batch_number', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      label="Expiry Date"
                      type="date"
                      value={item.expiry_date}
                      onChange={(e) => handleUpdateBulkRow(idx, 'expiry_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      label="Shelf Location"
                      placeholder="e.g. Bay 2"
                      value={item.shelf_location}
                      onChange={(e) => handleUpdateBulkRow(idx, 'shelf_location', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      label="Supplier"
                      placeholder="e.g. MedSupply"
                      value={item.supplier_name}
                      onChange={(e) => handleUpdateBulkRow(idx, 'supplier_name', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBulkRow}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Another Item
            </Button>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBulkReceiveModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={bulkSubmitting}
                className="text-xs font-bold px-5 bg-[#5345E6] hover:bg-[#4336D6] text-white rounded-xl"
              >
                Confirm Bulk Receive ({bulkItems.filter((i) => i.product_id && parseInt(i.quantity) > 0).length} Items)
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Transfer Stock Modal (Store -> Dispensary) */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title={t('inventory.transfer_stock')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleTransferStock} className="space-y-4">
          <Select
            label="Product"
            required
            value={transferForm.product_id}
            onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
            placeholder="Select product to transfer"
            options={productsList.map((p) => ({ value: p.id, label: p.name }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="From Location"
              value={transferForm.from_location}
              onChange={(e) => {
                const newFrom = e.target.value;
                setTransferForm({
                  ...transferForm,
                  from_location: newFrom,
                  to_location: newFrom === 'STORE' ? 'DISPENSARY' : 'STORE',
                });
              }}
              options={[
                { value: 'STORE', label: 'Store (Warehouse)' },
                { value: 'DISPENSARY', label: 'Dispensary' },
              ]}
            />
            <Select
              label="To Location"
              value={transferForm.to_location}
              onChange={(e) => setTransferForm({ ...transferForm, to_location: e.target.value })}
              options={[
                { value: 'DISPENSARY', label: 'Dispensary (Counter)' },
                { value: 'STORE', label: 'Store' },
              ]}
            />
          </div>

          {/* Smart Batch Auto-Selection & Guidance */}
          {transferForm.product_id && (
            <div>
              {loadingBatches ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center space-x-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Checking stock and batch availability...</span>
                </div>
              ) : availableBatches.length === 1 ? (
                /* 1. Single Batch: Automatically Selected */
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center text-emerald-900">
                    <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600 flex-shrink-0" />
                    <span>Single Batch Auto-Selected</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Batch: <strong className="font-mono">{availableBatches[0].batch_number || 'Default'}</strong> • Stock: <strong>{availableBatches[0].quantity} units</strong> • Exp: {availableBatches[0].expiry_date ? new Date(availableBatches[0].expiry_date).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
              ) : availableBatches.length > 1 ? (
                /* 2. Multiple Batches: Prompt the user to select the correct batch */
                <div className="space-y-2">
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      <strong>Multiple Batches Found ({availableBatches.length}):</strong> Please select which batch to transfer.
                    </span>
                  </div>
                  <Select
                    label="Select Batch"
                    required
                    value={transferForm.batch_number}
                    onChange={(e) => setTransferForm({ ...transferForm, batch_number: e.target.value })}
                    placeholder="Choose batch to transfer..."
                    options={availableBatches.map((b) => ({
                      value: b.batch_number || '',
                      label: `Batch ${b.batch_number || 'Default'} — ${b.quantity} units (Exp: ${b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-GB') : 'N/A'})`,
                    }))}
                  />
                </div>
              ) : (
                /* 3. No Stock in source location */
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>No available stock in {transferForm.from_location} for this product.</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batch Number"
              placeholder="Auto-filled or selected above"
              value={transferForm.batch_number}
              readOnly={availableBatches.length <= 1}
              onChange={(e) => setTransferForm({ ...transferForm, batch_number: e.target.value })}
            />
            <Input
              label="Quantity to Move"
              type="number"
              required
              min="1"
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
            />
          </div>
          <Input
            label="Transfer Notes"
            placeholder="e.g. Weekly counter restock"
            value={transferForm.notes}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
          />
          <Button
            type="submit"
            className="w-full py-2.5 font-semibold mt-2"
            disabled={availableBatches.length === 0 && Boolean(transferForm.product_id)}
          >
            Complete Transfer
          </Button>
        </form>
      </Modal>

      {/* Adjust Discrepancy & Expiration Date Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={`Adjust Stock & Expiration: ${selectedItemForAdjust?.product?.name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100">
            <p><strong>Location:</strong> {selectedItemForAdjust?.location}</p>
            <p><strong>Current Quantity:</strong> {selectedItemForAdjust?.quantity}</p>
            <p><strong>Current Batch:</strong> {selectedItemForAdjust?.batch_number || 'None'}</p>
            <p>
              <strong>Current Expiry:</strong>{' '}
              {selectedItemForAdjust?.expiry_date
                ? new Date(selectedItemForAdjust.expiry_date).toISOString().split('T')[0]
                : 'Not Set'}
            </p>
          </div>

          <div className="space-y-3">
            <Input
              label="Expiration Date"
              type="date"
              value={adjustExpiry}
              onChange={(e) => setAdjustExpiry(e.target.value)}
              helper="Edit, add, or change the expiration date for this stock"
            />
            <Input
              label="Batch / Lot Number"
              placeholder="e.g. BATCH-2026-01"
              value={adjustBatch}
              onChange={(e) => setAdjustBatch(e.target.value)}
            />
            <Input
              label="New Correct Quantity"
              type="number"
              min="0"
              required
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
            />
            <Input
              label="Audit Reason"
              placeholder="e.g. Corrected expiration date, inventory count mismatch"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full py-2.5 font-semibold">
            Save Changes
          </Button>
        </form>
      </Modal>
    </div>
  );
};
