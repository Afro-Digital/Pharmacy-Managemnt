import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Package, Plus, Edit2, Trash2, Search, FileText } from 'lucide-react';

export const ProductsPage = () => {
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal & Form
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const initialFormState = {
    name: '',
    name_am: '',
    generic_name: '',
    category_id: '',
    product_type: 'MEDICINE',
    dosage_form: '',
    strength: '',
    brand: '',
    manufacturer: '',
    unit_price: '',
    reorder_level: 10,
    requires_prescription: false,
    barcode: '',
    description: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ limit: '100' });
      if (searchQuery) queryParams.append('search', searchQuery);
      if (typeFilter) queryParams.append('product_type', typeFilter);
      if (categoryFilter) queryParams.append('category_id', categoryFilter);

      const res = await api.get(`/products?${queryParams.toString()}`);
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error('Products load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, typeFilter, categoryFilter]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data.success) setCategories(res.data.data);
      } catch (err) {
        console.error('Categories load error:', err);
      }
    };
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setProductModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name || '',
      name_am: prod.name_am || '',
      generic_name: prod.generic_name || '',
      category_id: prod.category_id || '',
      product_type: prod.product_type || 'MEDICINE',
      dosage_form: prod.dosage_form || '',
      strength: prod.strength || '',
      brand: prod.brand || '',
      manufacturer: prod.manufacturer || '',
      unit_price: prod.unit_price || '',
      reorder_level: prod.reorder_level || 10,
      requires_prescription: prod.requires_prescription || false,
      barcode: prod.barcode || '',
      description: prod.description || '',
    });
    setProductModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, formData);
        setSuccessMessage('Product updated successfully');
      } else {
        await api.post('/products', formData);
        setSuccessMessage('Product created successfully');
      }
      setProductModalOpen(false);
      fetchProducts();
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to save product');
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      setSuccessMessage('Product deactivated successfully');
      fetchProducts();
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Deactivation failed');
    }
  };

  const { user } = useAuth();
  const canEditProducts = user?.role === 'ADMIN' || user?.role === 'PHARMACIST';

  const baseColumns = [
    {
      header: t('products.name'),
      accessor: 'name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.name}</div>
          {row.name_am && <div className="text-xs text-blue-600 font-medium">{row.name_am}</div>}
          {row.generic_name && <div className="text-xs text-slate-400">Generic: {row.generic_name}</div>}
        </div>
      ),
    },
    {
      header: t('products.type'),
      accessor: 'product_type',
      render: (row) => (
        <Badge variant={row.product_type === 'MEDICINE' ? 'info' : 'warning'}>
          {row.product_type}
        </Badge>
      ),
    },
    {
      header: t('products.dosage_form'),
      accessor: 'dosage_form',
      render: (row) => row.dosage_form ? `${row.dosage_form} ${row.strength || ''}` : '—',
    },
    {
      header: t('products.unit_price'),
      accessor: 'unit_price',
      render: (row) => (
        <span className="font-bold text-slate-900">
          {parseFloat(row.unit_price).toFixed(2)} ETB
        </span>
      ),
    },
    {
      header: t('products.reorder_level'),
      accessor: 'reorder_level',
      render: (row) => row.reorder_level,
    },
    {
      header: 'Prescription',
      accessor: 'requires_prescription',
      render: (row) =>
        row.requires_prescription ? (
          <Badge variant="danger" size="xs">Rx Required</Badge>
        ) : (
          <Badge variant="neutral" size="xs">OTC</Badge>
        ),
    },
  ];

  const columns = canEditProducts
    ? [
        ...baseColumns,
        {
          header: 'Actions',
          accessor: 'actions',
          render: (row) => (
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
                <Edit2 className="w-3.5 h-3.5 text-slate-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDeactivate(row.id)}>
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </Button>
            </div>
          ),
        },
      ]
    : baseColumns;

  return (
    <div className="space-y-6">
      {/* Page Title & Add Product Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('products.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {canEditProducts
              ? 'Manage pharmaceutical catalog, cosmetic products, and pricing in ETB'
              : 'View pharmaceutical catalog and pricing (Cashier Read-Only View)'}
          </p>
        </div>
        {canEditProducts && (
          <Button onClick={openAddModal} className="text-sm shadow-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {t('products.add_new')}
          </Button>
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

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder={t('products.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder={t('products.all_types')}
            options={[
              { value: 'MEDICINE', label: t('products.medicine') },
              { value: 'COSMETIC', label: t('products.cosmetic') },
            ]}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder={t('products.all_categories')}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </div>

      {/* Table */}
      <Table columns={columns} data={products} isLoading={loading} />

      {/* Product Add / Edit Modal */}
      <Modal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProduct ? t('products.edit') : t('products.add_new')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('products.type')}
              required
              value={formData.product_type}
              onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
              options={[
                { value: 'MEDICINE', label: t('products.medicine') },
                { value: 'COSMETIC', label: t('products.cosmetic') },
              ]}
            />
            <Select
              label="Category"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              placeholder="Select Category"
              options={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('products.name')}
              required
              placeholder="e.g. Amoxicillin 500mg"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label={t('products.name_am')}
              placeholder="e.g. አሞክሲሊን 500mg"
              value={formData.name_am}
              onChange={(e) => setFormData({ ...formData, name_am: e.target.value })}
            />
          </div>

          {/* Pharmaceutical Conditional Fields */}
          {formData.product_type === 'MEDICINE' && (
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Pharmaceutical Specifics
              </h5>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label={t('products.generic_name')}
                  placeholder="e.g. Amoxicillin"
                  value={formData.generic_name}
                  onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                />
                <Input
                  label={t('products.dosage_form')}
                  placeholder="e.g. Capsule, Syrup"
                  value={formData.dosage_form}
                  onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                />
                <Input
                  label={t('products.strength')}
                  placeholder="e.g. 500mg, 10ml"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                />
              </div>
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.requires_prescription}
                  onChange={(e) => setFormData({ ...formData, requires_prescription: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{t('products.requires_rx')}</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('products.brand')}
              placeholder="e.g. Epharm, Nivea"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
            <Input
              label={t('products.manufacturer')}
              placeholder="e.g. Ethiopian Pharmaceuticals"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={t('products.unit_price')}
              type="number"
              step="0.01"
              required
              min="0"
              placeholder="0.00"
              value={formData.unit_price}
              onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
            />
            <Input
              label={t('products.reorder_level')}
              type="number"
              min="0"
              placeholder="10"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
            />
            <Input
              label={t('products.barcode')}
              placeholder="MED-AMX-500"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full py-2.5 font-bold mt-2">
            {editingProduct ? 'Update Product' : 'Save Product'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};
