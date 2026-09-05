import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import api, { API_BASE } from '../../services/api';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  FileText,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Check,
  Eye,
  Calendar,
} from 'lucide-react';

export const ProductsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEditProducts = user && user.role === 'ADMIN';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // View Details Modal (All users)
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProductForView, setSelectedProductForView] = useState(null);

  // Modal & Form (Admin only)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Bulk Upload State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  const formatExpiryForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

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
    expiry_date: '',
    batch_number: '',
    initial_quantity: '',
    initial_location: 'STORE',
    inventory_id: '',
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
    const primaryInv = prod.inventory?.[0];
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
      expiry_date: formatExpiryForInput(primaryInv?.expiry_date),
      batch_number: primaryInv?.batch_number || '',
      initial_quantity: primaryInv?.quantity !== undefined ? primaryInv.quantity : '',
      initial_location: primaryInv?.location || 'STORE',
      inventory_id: primaryInv?.id || '',
    });
    setProductModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        unit_price: parseFloat(formData.unit_price) || 0,
        reorder_level: parseInt(formData.reorder_level) || 10,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        setSuccessMessage(t('products.update_success'));
      } else {
        await api.post('/products', payload);
        setSuccessMessage(t('products.create_success'));
      }

      setProductModalOpen(false);
      fetchProducts();
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Error saving product');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate product "${name}"?`)) return;

    try {
      await api.delete(`/products/${id}`);
      setSuccessMessage('Product deactivated successfully');
      fetchProducts();
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Error deactivating product');
    }
  };

  // --- CSV Bulk Upload Logic ---
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseLine = (line) => {
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const headers = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cells[idx] !== undefined ? cells[idx].replace(/^["']|["']$/g, '') : '';
      });
      rows.push(rowObj);
    }
    return { headers, rows };
  };

  const handleCSVFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') return;

      const { rows } = parseCSV(text);
      const errors = [];
      const validated = rows.map((r, idx) => {
        const rowNum = idx + 2; // header is row 1
        const name = (r.Name || r.name || '').trim();
        const price = parseFloat(r.Unit_Price_ETB || r.unit_price);
        const type = (r.Product_Type || r.product_type || 'MEDICINE').toUpperCase();

        const rowErrors = [];
        if (!name) rowErrors.push('Missing product name');
        if (isNaN(price) || price < 0) rowErrors.push('Invalid unit price');
        if (type !== 'MEDICINE' && type !== 'COSMETIC') rowErrors.push('Type must be MEDICINE or COSMETIC');

        if (rowErrors.length > 0) {
          errors.push({ row: rowNum, name: name || 'Unnamed', errors: rowErrors });
        }

        const expiry_date = (r.Expiry_Date || r.expiry_date || '').trim();
        const batch_number = (r.Batch_Number || r.batch_number || '').trim();
        const quantity = (r.Quantity || r.quantity || '').trim();

        return {
          ...r,
          name,
          unit_price: isNaN(price) ? 0 : price,
          product_type: type,
          expiry_date,
          batch_number,
          quantity,
          isValid: rowErrors.length === 0,
          errorString: rowErrors.join(', '),
        };
      });

      setParsedRows(validated);
      setBulkErrors(errors);
      setImportSummary(null);
    };

    reader.readAsText(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/products/import-template', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'product_import_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Blob download failed, falling back to direct link', err);
      window.open(`${API_BASE}/products/import-template`, '_blank');
    }
  };

  const handleExecuteBulkImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage('No valid rows to import.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/products/bulk-upload', { products: validRows });
      if (res.data.success) {
        setImportSummary(res.data.data);
        setSuccessMessage(res.data.message);
        fetchProducts();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Bulk upload failed');
    } finally {
      setIsImporting(false);
    }
  };

  const columns = [
    {
      header: t('products.name'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 flex-shrink-0">
            {row.product_type === 'COSMETIC' ? (
              <Package className="w-4 h-4 text-purple-600" />
            ) : (
              <Package className="w-4 h-4 text-[#5345E6]" />
            )}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm">{row.name}</div>
            {row.name_am ? (
              <div className="text-[11px] text-slate-400 font-ethiopic">{row.name_am}</div>
            ) : (
              <div className="text-[11px] text-slate-400 font-medium">
                {row.generic_name || row.brand || 'General Product'}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      header: t('products.type'),
      accessor: 'product_type',
      render: (row) => (
        <Badge variant={row.product_type === 'MEDICINE' ? 'primary' : 'info'}>
          {t(`products.${row.product_type.toLowerCase()}`)}
        </Badge>
      ),
    },
    {
      header: t('products.category'),
      accessor: 'category',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600">
          {row.category?.name || '—'}
        </span>
      ),
    },
    {
      header: t('products.unit_price'),
      accessor: 'unit_price',
      render: (row) => (
        <span className="font-bold text-slate-900">
          ETB {parseFloat(row.unit_price).toFixed(2)}
        </span>
      ),
    },
    {
      header: t('products.reorder_level'),
      accessor: 'reorder_level',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 font-medium">
          {row.reorder_level} units
        </span>
      ),
    },
    {
      header: t('products.rx_required'),
      accessor: 'requires_prescription',
      render: (row) => (
        <Badge variant={row.requires_prescription ? 'warning' : 'neutral'}>
          {row.requires_prescription ? t('common.yes') : t('common.no')}
        </Badge>
      ),
    },
    {
      header: 'Expiration Date',
      accessor: 'expiry_date',
      render: (row) => {
        const batches = row.inventory?.filter((i) => i.expiry_date) || [];
        if (batches.length === 0) {
          return (
            <span className="text-xs text-slate-400 font-medium italic">
              Not Set
            </span>
          );
        }

        const sorted = [...batches].sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const earliest = sorted[0].expiry_date;
        const exp = new Date(earliest);
        const today = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(today.getDate() + 30);
        const dateFormatted = exp.toISOString().split('T')[0];

        let badgeVariant = 'success';
        let label = dateFormatted;
        if (exp < today) {
          badgeVariant = 'danger';
          label = `Expired: ${dateFormatted}`;
        } else if (exp <= thirtyDays) {
          badgeVariant = 'warning';
          label = `Exp: ${dateFormatted}`;
        }

        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge variant={badgeVariant}>{label}</Badge>
            {batches.length > 1 && (
              <span className="text-[10px] text-slate-400 font-medium">
                +{batches.length - 1} other {batches.length - 1 === 1 ? 'batch' : 'batches'}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const openViewModal = (product) => {
    setSelectedProductForView(product);
    setViewModalOpen(true);
  };

  columns.push({
    header: 'Actions',
    accessor: 'actions',
    render: (row) => (
      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => openViewModal(row)}
          className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#5345E6] flex items-center justify-center transition-colors"
          title="View Product Details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        {canEditProducts && (
          <>
            <button
              type="button"
              onClick={() => openEditModal(row)}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#5345E6] flex items-center justify-center transition-colors"
              title="Edit Product"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row.id, row.name)}
              className="w-8 h-8 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
              title="Deactivate Product"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    ),
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('products.title')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('products.total_count', { count: products.length })}
          </p>
        </div>
        {canEditProducts && (
          <div className="flex items-center space-x-2.5">
            <Button
              variant="secondary"
              onClick={() => {
                setParsedRows([]);
                setBulkErrors([]);
                setImportSummary(null);
                setBulkModalOpen(true);
              }}
              className="text-xs font-bold px-4 py-2.5"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Bulk Import CSV
            </Button>
            <Button onClick={openAddModal} className="text-xs font-bold px-4 py-2.5 shadow-xs">
              <Plus className="w-4 h-4 mr-1.5" />
              {t('products.add_new')}
            </Button>
          </div>
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
            pill
            placeholder={t('products.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            pill
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
            pill
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
              label={t('products.category')}
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              options={categories
                .filter((c) => c.type === formData.product_type)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('products.name_en')}
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

          {formData.product_type === 'MEDICINE' ? (
            <div className="grid grid-cols-3 gap-3">
              <Input
                label={t('products.generic_name')}
                placeholder="Amoxicillin"
                value={formData.generic_name}
                onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
              />
              <Input
                label={t('products.dosage_form')}
                placeholder="Capsule, Tablet, Syrup"
                value={formData.dosage_form}
                onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
              />
              <Input
                label={t('products.strength')}
                placeholder="500mg, 100ml"
                value={formData.strength}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Brand"
                placeholder="e.g. Nivea"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
              <Input
                label="Volume / Size"
                placeholder="e.g. 200ml, 50g"
                value={formData.strength}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
              />
            </div>
          )}

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

          {/* Expiration Date & Batch Tracking Section */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                <Calendar className="w-4 h-4 text-[#5345E6]" />
                <span>Expiration & Batch Tracking</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {editingProduct ? 'Edit, add, or change expiration date' : 'Set initial expiration date & batch'}
              </span>
            </div>

            {editingProduct && editingProduct.inventory && editingProduct.inventory.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">Select Batch to Update</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                  {editingProduct.inventory.map((inv) => {
                    const isSelected = formData.inventory_id === inv.id;
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            inventory_id: inv.id,
                            batch_number: inv.batch_number || '',
                            expiry_date: formatExpiryForInput(inv.expiry_date),
                          });
                        }}
                        className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                          isSelected
                            ? 'border-[#5345E6] bg-indigo-50/60 font-bold text-[#5345E6]'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{inv.batch_number || 'Default Batch'}</span>
                          <span className="text-[10px] font-mono text-slate-500">{inv.location} ({inv.quantity} units)</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Exp: {inv.expiry_date ? new Date(inv.expiry_date).toISOString().split('T')[0] : 'None'}
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        inventory_id: '',
                        batch_number: '',
                        expiry_date: '',
                      });
                    }}
                    className={`text-left p-2.5 rounded-xl border border-dashed text-xs transition-all flex items-center justify-center ${
                      !formData.inventory_id
                        ? 'border-[#5345E6] bg-indigo-50/60 font-bold text-[#5345E6]'
                        : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    + Add New Batch / Expiry Date
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Expiration Date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                helper="Date after which item must not be dispensed"
              />
              <Input
                label="Batch / Lot Number"
                placeholder="e.g. BATCH-2026-01"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                helper="Manufacturer lot or batch code"
              />
            </div>

            {!editingProduct && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Input
                  label="Initial Stock Quantity (Optional)"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.initial_quantity}
                  onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                />
                <Select
                  label="Initial Stock Location"
                  value={formData.initial_location || 'STORE'}
                  onChange={(e) => setFormData({ ...formData, initial_location: e.target.value })}
                  options={[
                    { value: 'STORE', label: 'Store (Bulk Warehouse)' },
                    { value: 'DISPENSARY', label: 'Dispensary (Front Counter)' },
                  ]}
                />
              </div>
            )}
          </div>

          <Button type="submit" className="w-full py-2.5 font-bold mt-2">
            {editingProduct ? 'Update Product & Expiration' : 'Save Product & Expiration'}
          </Button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* Bulk Product Upload Modal with CSV Template                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Mass Product Upload (CSV)"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Step 1: Template download and guide */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center">
                <FileSpreadsheet className="w-4 h-4 mr-1 text-blue-600" />
                Customizable CSV Import Template
              </h4>
              <p className="text-xs text-blue-700">
                Download the standardized CSV template with pre-filled examples for both <strong>MEDICINE</strong> and <strong>COSMETIC</strong> items.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="bg-white border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template (.csv)
            </Button>
          </div>

          {/* Step 2: Upload CSV File */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Select CSV File to Upload
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 rounded-2xl p-6 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVFileChange}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-800 block">
                Click to browse or drag & drop CSV file
              </span>
              <span className="text-xs text-slate-400">
                Accepts UTF-8 encoded .csv files with standard columns
              </span>
            </div>
          </div>

          {/* Step 3: Preview and Validation */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Data Preview ({parsedRows.length} rows found)
                </h5>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-emerald-700 font-semibold">
                    ✓ {parsedRows.filter((r) => r.isValid).length} Valid
                  </span>
                  {bulkErrors.length > 0 && (
                    <span className="text-rose-600 font-semibold">
                      ⚠ {bulkErrors.length} Invalid
                    </span>
                  )}
                </div>
              </div>

              {bulkErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1 max-h-28 overflow-y-auto">
                  <div className="font-bold">Validation Issues:</div>
                  {bulkErrors.map((err, i) => (
                    <div key={i}>
                      Row {err.row} ({err.name}): {err.errors.join(', ')}
                    </div>
                  ))}
                </div>
              )}

              {/* Table Preview (first 5 rows) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Price (ETB)</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Expiry Date</th>
                      <th className="p-2">Batch No.</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className={row.isValid ? 'bg-white' : 'bg-rose-50/50'}>
                        <td className="p-2 font-mono text-slate-400">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-800">{row.name || '—'}</td>
                        <td className="p-2">
                          <Badge variant={row.product_type === 'COSMETIC' ? 'info' : 'primary'}>
                            {row.product_type}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono">ETB {row.unit_price}</td>
                        <td className="p-2 text-slate-600">{row.Category || row.category || 'Default'}</td>
                        <td className="p-2 font-mono text-slate-700">
                          {row.expiry_date ? (
                            <span className="text-emerald-700 font-semibold">{row.expiry_date}</span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="p-2 font-mono text-slate-600">
                          {row.batch_number || '—'}
                        </td>
                        <td className="p-2">
                          {row.isValid ? (
                            <span className="text-emerald-600 font-semibold flex items-center">
                              <Check className="w-3.5 h-3.5 mr-0.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold">{row.errorString}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[11px] text-slate-400 text-right">
                  Showing first 10 of {parsedRows.length} rows
                </p>
              )}
            </div>
          )}

          {/* Step 4: Import confirmation */}
          {importSummary && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <div className="font-bold flex items-center text-emerald-900">
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                Bulk Import Completed!
              </div>
              <p>
                Successfully imported <strong>{importSummary.successCount}</strong> products.
                {importSummary.failedCount > 0 && ` ${importSummary.failedCount} rows skipped due to errors.`}
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="button"
              onClick={handleExecuteBulkImport}
              disabled={isImporting || parsedRows.filter((r) => r.isValid).length === 0}
              className="w-full py-2.5 font-bold bg-[#5345E6] hover:bg-[#4336D6] disabled:opacity-50 text-white rounded-xl"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Importing Products...
                </>
              ) : (
                `Import ${parsedRows.filter((r) => r.isValid).length} Valid Products`
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* View Product Details Modal (Accessible to All Roles)                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Product Specifications & Details"
        maxWidth="max-w-2xl"
      >
        {selectedProductForView && (
          <div className="space-y-5">
            {/* Header with thumbnail & badges */}
            <div className="flex items-start justify-between p-4 bg-[#F4F5FA] rounded-2xl border border-slate-100">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/70 flex items-center justify-center text-[#5345E6] shadow-xs">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedProductForView.name}
                  </h3>
                  {selectedProductForView.name_am && (
                    <p className="text-xs text-slate-500 font-ethiopic">
                      {selectedProductForView.name_am}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {selectedProductForView.generic_name || selectedProductForView.brand || 'Standard Item'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <Badge variant={selectedProductForView.product_type === 'MEDICINE' ? 'primary' : 'info'}>
                  {selectedProductForView.product_type}
                </Badge>
                <Badge variant={selectedProductForView.requires_prescription ? 'warning' : 'neutral'}>
                  {selectedProductForView.requires_prescription ? 'Prescription Required' : 'Over-the-Counter'}
                </Badge>
              </div>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Unit Price</span>
                <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                  ETB {parseFloat(selectedProductForView.unit_price).toFixed(2)}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Category</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                  {selectedProductForView.category?.name || 'Unassigned'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Reorder Threshold</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                  {selectedProductForView.reorder_level} units
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Barcode / SKU</span>
                <span className="text-xs font-mono font-medium text-slate-700 mt-0.5 block truncate">
                  {selectedProductForView.barcode || 'None (Auto-generated)'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Strength</span>
                <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                  {selectedProductForView.strength || 'Standard'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Dosage Form</span>
                <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                  {selectedProductForView.dosage_form || 'Unit'}
                </span>
              </div>
            </div>

            {selectedProductForView.description && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] mb-1">
                  Product Notes & Clinical Guidelines
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {selectedProductForView.description}
                </p>
              </div>
            )}

            {/* Stock Batches & Expiration Dates Section */}
            <div className="p-3.5 bg-white rounded-xl border border-slate-100 space-y-2">
              <span className="text-slate-500 font-semibold block uppercase text-[10px]">
                Stock Batches & Expiration Dates
              </span>
              {selectedProductForView.inventory && selectedProductForView.inventory.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {selectedProductForView.inventory.map((inv, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">
                          Batch: {inv.batch_number || 'Default Batch'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Location: {inv.location} • Qty: {inv.quantity} units {inv.shelf_location ? `• Shelf: ${inv.shelf_location}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        {inv.expiry_date ? (
                          <span className="font-mono font-semibold text-slate-700">
                            Exp: {new Date(inv.expiry_date).toISOString().split('T')[0]}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No expiry recorded</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No inventory batches registered yet.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
              {canEditProducts && (
                <Button
                  size="sm"
                  onClick={() => {
                    setViewModalOpen(false);
                    openEditModal(selectedProductForView);
                  }}
                  className="text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Product & Expiration
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
