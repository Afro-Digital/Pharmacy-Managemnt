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
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Lock,
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
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState('');
  const [deleteAllConfirmPhrase, setDeleteAllConfirmPhrase] = useState('');
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState(null);
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
    unit: 'strip',
    brand: '',
    manufacturer: '',
    unit_price: '',
    reorder_level: 10,
    requires_prescription: false,
    barcode: '',
    sku: '',
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
    setErrorMessage(null);
    setProductModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    setErrorMessage(null);
    const primaryInv = prod.inventory?.[0];
    setFormData({
      name: prod.name || '',
      name_am: prod.name_am || '',
      generic_name: prod.generic_name || '',
      category_id: prod.category_id || '',
      product_type: prod.product_type || 'MEDICINE',
      dosage_form: prod.dosage_form || '',
      strength: prod.strength || '',
      unit: prod.unit || 'strip',
      brand: prod.brand || '',
      manufacturer: prod.manufacturer || '',
      unit_price: prod.unit_price || '',
      reorder_level: prod.reorder_level !== undefined ? prod.reorder_level : 10,
      requires_prescription: prod.requires_prescription || false,
      barcode: prod.barcode || '',
      sku: prod.sku || '',
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
    setErrorMessage(null);

    // Strict validation for the 10 required fields
    const missing = [];
    if (!formData.name?.trim()) missing.push('Name');
    if (!formData.product_type) missing.push('Product Type');
    const price = parseFloat(formData.unit_price);
    if (formData.unit_price === '' || isNaN(price) || price < 0) missing.push('Unit Price (ETB)');
    if (formData.requires_prescription === undefined || formData.requires_prescription === null) {
      missing.push('Requires Prescription');
    }
    if (!formData.expiry_date) missing.push('Expiry Date');
    if (!formData.batch_number?.trim()) missing.push('Batch Number');
    if (formData.initial_quantity === '' || isNaN(parseInt(formData.initial_quantity)) || parseInt(formData.initial_quantity) < 0) {
      missing.push('Quantity');
    }
    if (!formData.unit?.trim()) missing.push('Unit (bottle, strip, sachet, ampule, etc.)');
    if (!formData.dosage_form?.trim()) missing.push('Dosage Form');
    if (!formData.strength?.trim()) missing.push('Strength (e.g., 100mg, 50g)');

    if (missing.length > 0) {
      setErrorMessage(`Please fill in all required fields: ${missing.join(', ')}`);
      return;
    }

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
      const seenFileKeys = new Map(); // key -> rowNum
      const validated = rows.map((r, idx) => {
        const rowNum = idx + 2; // header is row 1
        const name = (r.Name || r.name || '').trim();
        const price = parseFloat(r.Unit_Price_ETB !== undefined ? r.Unit_Price_ETB : (r.unit_price !== undefined ? r.unit_price : r['Unit Price']));
        const type = (r.Product_Type || r.product_type || '').toUpperCase().trim();
        const batch_number = (r.Batch_Number || r.batch_number || r['Batch Number'] || '').trim();
        const expiry_date = (r.Expiry_Date || r.expiry_date || r['Expiry Date'] || '').trim();
        const quantityStr = (r.Quantity !== undefined ? r.Quantity : (r.quantity !== undefined ? r.quantity : (r.initial_quantity !== undefined ? r.initial_quantity : r['Qty'] || ''))).toString().trim();
        const unit = (r.Unit || r.unit || r['Unit(bottle, stp, sachets, ampule)'] || r['Packaging Unit'] || '').trim();
        const dosage_form = (r.Dosage_Form || r.dosage_form || r['Dosage Form'] || '').trim();
        const strength = (r.Strength || r.strength || '').trim();
        const rxRaw = r.Requires_Prescription !== undefined ? r.Requires_Prescription : (r.requires_prescription !== undefined ? r.requires_prescription : r.requires_rx);

        const rowErrors = [];
        if (!name) rowErrors.push('Missing Name');
        if (!type || (type !== 'MEDICINE' && type !== 'COSMETIC')) rowErrors.push('Product Type must be MEDICINE or COSMETIC');
        if (isNaN(price) || price < 0 || (r.Unit_Price_ETB === '' && r.unit_price === '')) rowErrors.push('Missing / Invalid Unit Price (ETB)');
        if (rxRaw === undefined || rxRaw === null || rxRaw === '') rowErrors.push('Missing Requires Prescription (true/false)');
        if (!expiry_date) {
          rowErrors.push('Missing Expiry Date');
        } else {
          const parsedD = new Date(expiry_date);
          if (isNaN(parsedD.getTime())) rowErrors.push('Invalid Expiry Date (use YYYY-MM-DD)');
        }
        if (!batch_number) rowErrors.push('Missing Batch Number');
        if (!quantityStr || isNaN(parseInt(quantityStr)) || parseInt(quantityStr) < 0) rowErrors.push('Missing / Invalid Quantity');
        if (!unit) rowErrors.push('Missing Unit (bottle, strip, sachet, ampule, etc.)');
        if (!dosage_form) rowErrors.push('Missing Dosage Form');
        if (!strength) rowErrors.push('Missing Strength (e.g., 100mg, 50g)');

        // Check duplicate within the uploaded CSV file
        const fileKey = `${name.toLowerCase()}__${batch_number.toLowerCase()}`;
        let isFileDuplicate = false;
        let duplicateOfRow = null;
        if (name && batch_number) {
          if (seenFileKeys.has(fileKey)) {
            isFileDuplicate = true;
            duplicateOfRow = seenFileKeys.get(fileKey);
            rowErrors.push(`Duplicate in file: Same medicine and batch as Row ${duplicateOfRow}`);
          } else {
            seenFileKeys.set(fileKey, rowNum);
          }
        }

        if (rowErrors.length > 0) {
          errors.push({ row: rowNum, name: name || 'Unnamed', errors: rowErrors });
        }

        return {
          ...r,
          name,
          unit_price: isNaN(price) ? 0 : price,
          product_type: type || 'MEDICINE',
          expiry_date,
          batch_number,
          quantity: quantityStr ? parseInt(quantityStr) : 0,
          unit,
          dosage_form,
          strength,
          requires_prescription: rxRaw !== undefined ? String(rxRaw).toLowerCase() === 'true' : false,
          isValid: rowErrors.length === 0,
          isFileDuplicate,
          duplicateOfRow,
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
      setErrorMessage('No valid rows to import. All 10 required fields must be filled for every product before importing.');
      return;
    }

    if (bulkErrors.length > 0) {
      const confirmIncomplete = window.confirm(
        `Warning: ${bulkErrors.length} row(s) have missing required fields and will NOT be imported.\n\nOnly the ${validRows.length} fully complete row(s) will be imported. Proceed?`
      );
      if (!confirmIncomplete) return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/products/bulk-upload', { products: validRows });
      if (res.data.success) {
        setImportSummary(res.data.data);
        setSuccessMessage(res.data.message || `Successfully processed ${res.data.data.successCount} product(s)`);
        fetchProducts();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Bulk upload failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!window.confirm('This will search for and merge any historical duplicate products in the database into single primary records. Proceed?')) {
      return;
    }
    setIsCleaningDuplicates(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/products/cleanup-duplicates');
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        fetchProducts();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to clean up duplicate products');
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleDeleteAllProducts = async (e) => {
    e.preventDefault();
    if (deleteAllConfirmPhrase.trim().toUpperCase() !== 'DELETE ALL PRODUCTS') {
      setDeleteAllError('Please type "DELETE ALL PRODUCTS" exactly to confirm.');
      return;
    }
    if (!deleteAllPassword) {
      setDeleteAllError('Administrator password is required.');
      return;
    }
    setDeleteAllLoading(true);
    setDeleteAllError(null);
    try {
      const res = await api.post('/danger-zone/delete-all-products', {
        password: deleteAllPassword,
        confirmPhrase: 'DELETE ALL PRODUCTS',
      });
      if (res.data.success) {
        setSuccessMessage(res.data.message);
        setDeleteAllModalOpen(false);
        setDeleteAllPassword('');
        setDeleteAllConfirmPhrase('');
        fetchProducts();
      }
    } catch (err) {
      setDeleteAllError(err.response?.data?.error?.message || 'Failed to delete all products');
    } finally {
      setDeleteAllLoading(false);
    }
  };

  const columns = [
    {
      header: t('products.name'),
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center space-x-3 min-w-[200px]">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 flex-shrink-0">
            {row.product_type === 'COSMETIC' ? (
              <Package className="w-4 h-4 text-purple-600" />
            ) : (
              <Package className="w-4 h-4 text-[#5345E6]" />
            )}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">{row.name}</div>
            {row.name_am && (
              <div className="text-[11px] text-slate-500 font-ethiopic mt-0.5">{row.name_am}</div>
            )}
            <div className="text-[11px] text-slate-400 font-medium truncate max-w-[220px] mt-0.5">
              {row.generic_name && <span>{row.generic_name}</span>}
              {row.brand && <span className="text-slate-600 font-semibold ml-1">({row.brand})</span>}
              {row.manufacturer && !row.brand && <span className="text-slate-400 ml-1">· {row.manufacturer}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Form & Strength',
      accessor: 'dosage_form',
      render: (row) => (
        <div className="flex flex-col items-start gap-1 min-w-[120px]">
          <div className="text-xs font-bold text-slate-800">
            {row.dosage_form || '—'}
            {row.strength && (
              <span className="ml-1 text-[#5345E6] font-semibold">({row.strength})</span>
            )}
          </div>
          {row.unit ? (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              {row.unit}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      header: t('products.type'),
      accessor: 'product_type',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={row.product_type === 'MEDICINE' ? 'primary' : 'info'}>
            {t(`products.${row.product_type?.toLowerCase() || 'medicine'}`)}
          </Badge>
          <span className="text-[11px] font-semibold text-slate-500">
            {row.category?.name || '—'}
          </span>
        </div>
      ),
    },
    {
      header: t('products.unit_price'),
      accessor: 'unit_price',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 text-sm">
            ETB {parseFloat(row.unit_price || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400">per {row.unit || 'unit'}</span>
        </div>
      ),
    },
    {
      header: 'Stock & Qty',
      accessor: 'stock',
      render: (row) => {
        const batches = row.inventory || [];
        const totalStock = batches.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const storeStock = batches.filter((i) => i.location === 'STORE').reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const dispStock = batches.filter((i) => i.location === 'DISPENSARY').reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const reorder = row.reorder_level || 0;

        let statusVariant = 'success';
        let statusLabel = 'In Stock';
        if (totalStock === 0) {
          statusVariant = 'danger';
          statusLabel = 'Out of Stock';
        } else if (totalStock <= reorder) {
          statusVariant = 'warning';
          statusLabel = `Low (${reorder} min)`;
        }

        return (
          <div className="flex flex-col items-start gap-1 min-w-[120px]">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-900 text-sm">
                {totalStock}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {row.unit || 'units'}
              </span>
              <Badge variant={statusVariant} className="text-[10px] py-0 px-1.5">
                {statusLabel}
              </Badge>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              Store: <strong className="text-slate-600">{storeStock}</strong> · Disp: <strong className="text-slate-600">{dispStock}</strong>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Batch & Expiry',
      accessor: 'expiry_date',
      render: (row) => {
        const batches = row.inventory?.filter((i) => i.expiry_date) || [];
        const allBatches = row.inventory || [];
        const primaryBatch = allBatches[0];

        if (batches.length === 0) {
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-mono text-xs text-slate-700 font-medium">
                {primaryBatch?.batch_number || '—'}
              </span>
              <span className="text-xs text-slate-400 font-medium italic">
                No Expiry Set
              </span>
            </div>
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
          <div className="flex flex-col items-start gap-1 min-w-[130px]">
            <div className="flex items-center space-x-1 font-mono text-xs text-slate-800 font-semibold">
              <span>{primaryBatch?.batch_number || sorted[0].batch_number || '—'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={badgeVariant} className="text-[10px]">{label}</Badge>
              {batches.length > 1 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  +{batches.length - 1} more
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Rx',
      accessor: 'requires_prescription',
      render: (row) => (
        <Badge variant={row.requires_prescription ? 'warning' : 'neutral'} className="text-[10px]">
          {row.requires_prescription ? 'Rx Required' : 'OTC'}
        </Badge>
      ),
    },
    {
      header: 'Barcode / SKU',
      accessor: 'barcode',
      render: (row) => (
        <div className="flex flex-col font-mono text-xs min-w-[110px]">
          <span className="font-semibold text-slate-800">{row.barcode || '—'}</span>
          <span className="text-[10px] text-slate-400">{row.sku || '—'}</span>
        </div>
      ),
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
          title="View Exact Specifications"
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAllModalOpen(true);
                setDeleteAllConfirmPhrase('');
                setDeleteAllPassword('');
                setDeleteAllError(null);
              }}
              className="text-xs font-bold px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              title="Danger Zone: Delete all products and inventory"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
              Delete All
            </Button>
            <Button
              variant="outline"
              onClick={handleCleanupDuplicates}
              disabled={isCleaningDuplicates}
              className="text-xs font-bold px-3 py-2 text-slate-600 hover:text-slate-900 border-slate-200"
              title="Merge duplicate products with identical names"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCleaningDuplicates ? 'animate-spin' : ''}`} />
              Deduplicate
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setParsedRows([]);
                setBulkErrors([]);
                setImportSummary(null);
                setBulkModalOpen(true);
              }}
              className="text-xs font-bold px-3.5 py-2"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Bulk Import CSV
            </Button>
            <Button onClick={openAddModal} className="text-xs font-bold px-4 py-2 shadow-xs">
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
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
            <span className="font-semibold">
              Fields marked with an asterisk (<span className="text-rose-500 font-bold">*</span>) are strictly required.
            </span>
            <span className="text-[11px] text-indigo-600 font-medium">
              Barcode & SKU are auto-generated if left blank
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={
                <span>
                  {t('products.type')} <span className="text-rose-500 font-bold">*</span>
                </span>
              }
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
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              options={[
                { value: '', label: 'Select Category (Optional)' },
                ...categories
                  .filter((c) => c.type === formData.product_type)
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={
                <span>
                  {t('products.name_en')} <span className="text-rose-500 font-bold">*</span>
                </span>
              }
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={
                <span>
                  {t('products.dosage_form')} <span className="text-rose-500 font-bold">*</span>
                </span>
              }
              required
              placeholder="e.g. Tablet, Capsule, Syrup, Cream"
              value={formData.dosage_form}
              onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
              helper="Capsule, Tablet, Syrup, Injection, Cream, etc."
            />
            <Input
              label={
                <span>
                  {t('products.strength')} <span className="text-rose-500 font-bold">*</span>
                </span>
              }
              required
              placeholder="e.g. 500mg, 100ml, 50g"
              value={formData.strength}
              onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
              helper="Concentration or package weight"
            />
            <Select
              label={
                <span>
                  Packaging Unit <span className="text-rose-500 font-bold">*</span>
                </span>
              }
              required
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'strip', label: 'Strip (ካርታ)' },
                { value: 'bottle', label: 'Bottle (ጠርሙስ)' },
                { value: 'sachet', label: 'Sachet (ፓኬት)' },
                { value: 'ampule', label: 'Ampule (አምፑል)' },
                { value: 'box', label: 'Box (ካርቶን / ሳጥን)' },
                { value: 'vial', label: 'Vial (ቫያል)' },
                { value: 'tube', label: 'Tube (ቱቦ)' },
                { value: 'tablet', label: 'Tablet (ኪኒን)' },
                { value: 'jar', label: 'Jar (ማሰሮ)' },
              ]}
              helper="Base dispensing/sales unit"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={
                <span>
                  {t('products.unit_price')} (ETB) <span className="text-rose-500 font-bold">*</span>
                </span>
              }
              type="number"
              step="0.01"
              required
              min="0"
              placeholder="0.00"
              value={formData.unit_price}
              onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
            />
            <Select
              label={
                <span>
                  Requires Prescription <span className="text-rose-500 font-bold">*</span>
                </span>
              }
              required
              value={formData.requires_prescription ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, requires_prescription: e.target.value === 'true' })}
              options={[
                { value: 'false', label: 'No (Over-The-Counter OTC)' },
                { value: 'true', label: 'Yes (Prescription Required Rx)' },
              ]}
            />
            <Input
              label={t('products.reorder_level')}
              type="number"
              min="0"
              placeholder="10"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              helper="Alert trigger for low stock"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Barcode (Auto-generated if empty)"
              placeholder="e.g. 890123456789 or scan"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              helper="Leave blank to auto-generate standard barcode"
            />
            <Input
              label="SKU (Auto-generated if empty)"
              placeholder="e.g. MED-AMX-101"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              helper="Leave blank to auto-generate SKU"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={t('products.generic_name')}
              placeholder="e.g. Amoxicillin Trihydrate"
              value={formData.generic_name}
              onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
            />
            <Input
              label="Brand"
              placeholder="e.g. Epharm, Cadila, Nivea"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
            <Input
              label="Manufacturer"
              placeholder="e.g. Ethiopian Pharmaceuticals"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            />
          </div>

          {/* Expiration Date & Batch Tracking Section */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                <Calendar className="w-4 h-4 text-[#5345E6]" />
                <span>Expiration & Batch Tracking (Required)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {editingProduct ? 'Edit or select batch to update' : 'Set initial batch & stock levels'}
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
                label={
                  <span>
                    Expiration Date <span className="text-rose-500 font-bold">*</span>
                  </span>
                }
                type="date"
                required
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                helper="Mandatory expiration date"
              />
              <Input
                label={
                  <span>
                    Batch / Lot Number <span className="text-rose-500 font-bold">*</span>
                  </span>
                }
                required
                placeholder="e.g. BATCH-2026-01"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                helper="Manufacturer lot or batch code"
              />
            </div>

            {!editingProduct && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Input
                  label={
                    <span>
                      Initial Stock Quantity <span className="text-rose-500 font-bold">*</span>
                    </span>
                  }
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 50"
                  value={formData.initial_quantity}
                  onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                  helper="Units to place in initial inventory"
                />
                <Select
                  label="Initial Stock Location"
                  value={formData.initial_location || 'STORE'}
                  onChange={(e) => setFormData({ ...formData, initial_location: e.target.value })}
                  options={[
                    { value: 'STORE', label: 'Store (Bulk Warehouse)' },
                    { value: 'DISPENSARY', label: 'Dispensary (Front Counter)' },
                  ]}
                  helper="Warehouse store or counter shelf"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Description / Clinical Guidelines (Optional)
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#5345E6]/20 focus:border-[#5345E6]"
              placeholder="e.g. Usage instructions, contraindications, or storage notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
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

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Price (ETB)</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2">Unit</th>
                      <th className="p-2">Dosage Form</th>
                      <th className="p-2">Strength</th>
                      <th className="p-2">Batch No.</th>
                      <th className="p-2">Expiry Date</th>
                      <th className="p-2">Rx</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 15).map((row, i) => (
                      <tr key={i} className={row.isValid ? 'bg-white' : 'bg-rose-50/50'}>
                        <td className="p-2 font-mono text-slate-400">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-800">{row.name || '—'}</td>
                        <td className="p-2">
                          <Badge variant={row.product_type === 'COSMETIC' ? 'info' : 'primary'}>
                            {row.product_type}
                          </Badge>
                        </td>
                        <td className="p-2 font-mono">ETB {row.unit_price}</td>
                        <td className="p-2 font-bold text-slate-800">{row.quantity ?? '—'}</td>
                        <td className="p-2 text-slate-600">{row.unit || <span className="text-rose-500 font-semibold italic">Missing</span>}</td>
                        <td className="p-2 text-slate-600">{row.dosage_form || <span className="text-rose-500 font-semibold italic">Missing</span>}</td>
                        <td className="p-2 text-slate-600">{row.strength || <span className="text-rose-500 font-semibold italic">Missing</span>}</td>
                        <td className="p-2 font-mono text-slate-600">
                          {row.batch_number || <span className="text-rose-500 font-semibold italic">Missing</span>}
                        </td>
                        <td className="p-2 font-mono text-slate-700">
                          {row.expiry_date ? (
                            <span className="text-emerald-700 font-semibold">{row.expiry_date}</span>
                          ) : (
                            <span className="text-rose-500 font-semibold italic">Missing</span>
                          )}
                        </td>
                        <td className="p-2">
                          {row.requires_prescription ? (
                            <span className="text-amber-700 font-semibold">Rx</span>
                          ) : (
                            <span className="text-slate-500">OTC</span>
                          )}
                        </td>
                        <td className="p-2">
                          {row.isValid ? (
                            <span className="text-emerald-600 font-semibold flex items-center">
                              <Check className="w-3.5 h-3.5 mr-0.5" /> Ready
                            </span>
                          ) : row.isFileDuplicate ? (
                            <span className="text-amber-600 font-semibold flex items-center" title={row.errorString}>
                              <AlertTriangle className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" /> Duplicate in file
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold text-[11px] block max-w-xs truncate" title={row.errorString}>
                              ⚠ {row.errorString}
                            </span>
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
            <div className="space-y-2">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-2">
                <div className="font-bold flex items-center text-emerald-900 text-sm">
                  <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Bulk Import Completed
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                    <div className="text-[11px] text-slate-500 font-medium">New Products</div>
                    <div className="text-base font-bold text-emerald-700">{importSummary.createdCount ?? importSummary.successCount}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                    <div className="text-[11px] text-slate-500 font-medium">New Batches Added</div>
                    <div className="text-base font-bold text-blue-600">{importSummary.updatedCount || 0}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                    <div className="text-[11px] text-slate-500 font-medium">Duplicates Prevented</div>
                    <div className="text-base font-bold text-amber-600">{importSummary.duplicateCount || 0}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                    <div className="text-[11px] text-slate-500 font-medium">Errors / Failed</div>
                    <div className="text-base font-bold text-rose-600">{importSummary.failedCount || 0}</div>
                  </div>
                </div>
              </div>

              {/* Show list of duplicates prevented if any */}
              {importSummary.duplicates && importSummary.duplicates.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 max-h-40 overflow-y-auto">
                  <div className="font-bold flex items-center text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-600 flex-shrink-0" />
                    Duplicates Prevented from Importing ({importSummary.duplicates.length}):
                  </div>
                  <ul className="divide-y divide-amber-200/50">
                    {importSummary.duplicates.map((dup, idx) => (
                      <li key={idx} className="py-1 flex justify-between items-center text-[11px]">
                        <span><strong>Row {dup.row}:</strong> {dup.name} {dup.batch_number !== 'None' && dup.batch_number !== 'N/A' ? `(Batch: ${dup.batch_number})` : ''}</span>
                        <span className="text-amber-700 italic ml-2">Already in catalog</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
        title="Product Information & Complete Details"
        maxWidth="max-w-3xl"
      >
        {selectedProductForView && (() => {
          const primaryBatch = selectedProductForView.inventory?.[0];
          const totalQty = (selectedProductForView.inventory || []).reduce((acc, inv) => acc + (inv.quantity || 0), 0);
          const storeQty = (selectedProductForView.inventory || []).filter((i) => i.location === 'STORE').reduce((acc, inv) => acc + (inv.quantity || 0), 0);
          const dispQty = (selectedProductForView.inventory || []).filter((i) => i.location === 'DISPENSARY').reduce((acc, inv) => acc + (inv.quantity || 0), 0);

          const renderVal = (val) => {
            if (val === null || val === undefined || val === '' || val === false && typeof val !== 'boolean') {
              return <span className="text-slate-400 font-mono font-bold">-</span>;
            }
            return <span className="font-semibold text-slate-800">{val}</span>;
          };

          return (
            <div className="space-y-4">
              {/* Header with thumbnail & badges */}
              <div className="flex items-start justify-between p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/70 flex items-center justify-center text-[#5345E6] shadow-xs">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {selectedProductForView.name || '-'}
                    </h3>
                    {selectedProductForView.name_am && (
                      <p className="text-xs text-slate-500 font-ethiopic">
                        {selectedProductForView.name_am}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {selectedProductForView.generic_name || selectedProductForView.brand || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1.5">
                  <Badge variant={selectedProductForView.product_type === 'MEDICINE' ? 'primary' : 'info'}>
                    {selectedProductForView.product_type || '-'}
                  </Badge>
                  <Badge variant={selectedProductForView.requires_prescription ? 'warning' : 'neutral'}>
                    {selectedProductForView.requires_prescription ? 'Prescription Required (Rx)' : 'Over-the-Counter (OTC)'}
                  </Badge>
                </div>
              </div>

              {/* Exact Information Grid */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Exact Entered Specifications
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Shows dash (-) if not filled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
                  {/* Left Column */}
                  <div className="divide-y divide-slate-100">
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Name:</span>
                      {renderVal(selectedProductForView.name)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Name (Amharic):</span>
                      {renderVal(selectedProductForView.name_am)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Product Type:</span>
                      {renderVal(selectedProductForView.product_type)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Category:</span>
                      {renderVal(selectedProductForView.category?.name)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Generic Name:</span>
                      {renderVal(selectedProductForView.generic_name)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Dosage Form:</span>
                      {renderVal(selectedProductForView.dosage_form)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Strength:</span>
                      {renderVal(selectedProductForView.strength)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Packaging Unit:</span>
                      {renderVal(selectedProductForView.unit)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Brand:</span>
                      {renderVal(selectedProductForView.brand)}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="divide-y divide-slate-100">
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Manufacturer:</span>
                      {renderVal(selectedProductForView.manufacturer)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Unit Price (ETB):</span>
                      {renderVal(selectedProductForView.unit_price ? `ETB ${parseFloat(selectedProductForView.unit_price).toFixed(2)}` : null)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Reorder Level:</span>
                      {renderVal(selectedProductForView.reorder_level !== undefined && selectedProductForView.reorder_level !== null ? `${selectedProductForView.reorder_level} units` : null)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Barcode:</span>
                      {renderVal(selectedProductForView.barcode)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">SKU:</span>
                      {renderVal(selectedProductForView.sku)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Requires Prescription:</span>
                      {renderVal(selectedProductForView.requires_prescription !== undefined && selectedProductForView.requires_prescription !== null ? (selectedProductForView.requires_prescription ? 'Yes (Rx)' : 'No (OTC)') : null)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Primary Batch:</span>
                      {renderVal(primaryBatch?.batch_number)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Expiry Date:</span>
                      {renderVal(primaryBatch?.expiry_date ? new Date(primaryBatch.expiry_date).toISOString().split('T')[0] : null)}
                    </div>
                    <div className="flex items-center justify-between p-2.5">
                      <span className="text-slate-500 font-medium">Total In Stock:</span>
                      {renderVal(totalQty > 0 ? `${totalQty} ${selectedProductForView.unit || 'units'} (Store: ${storeQty}, Dispensary: ${dispQty})` : '0 units')}
                    </div>
                  </div>
                </div>

                {/* Description Row */}
                <div className="p-3 bg-slate-50/60 border-t border-slate-100 text-xs flex items-start space-x-2">
                  <span className="text-slate-500 font-medium w-28 flex-shrink-0">Description:</span>
                  <div className="text-slate-700 flex-1">
                    {renderVal(selectedProductForView.description)}
                  </div>
                </div>
              </div>

              {/* All Inventory Batches Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Registered Batches & Storage Locations ({selectedProductForView.inventory?.length || 0})
                  </span>
                </div>
                {selectedProductForView.inventory && selectedProductForView.inventory.length > 0 ? (
                  <div className="overflow-x-auto max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="p-2">Batch No</th>
                          <th className="p-2">Location</th>
                          <th className="p-2">Quantity</th>
                          <th className="p-2">Expiry Date</th>
                          <th className="p-2">Shelf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedProductForView.inventory.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2 font-mono font-medium text-slate-800">{inv.batch_number || '-'}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.location === 'DISPENSARY' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                                {inv.location}
                              </span>
                            </td>
                            <td className="p-2 font-bold text-slate-900">{inv.quantity} {selectedProductForView.unit || 'units'}</td>
                            <td className="p-2 font-mono text-slate-700">
                              {inv.expiry_date ? new Date(inv.expiry_date).toISOString().split('T')[0] : '-'}
                            </td>
                            <td className="p-2 text-slate-500">{inv.shelf_location || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 italic">
                    No inventory batches registered yet.
                  </div>
                )}
              </div>

              {/* Modal footer */}
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
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Product
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ========================================================================= */}
      {/* Danger Zone: Delete All Products Modal                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={deleteAllModalOpen}
        onClose={() => setDeleteAllModalOpen(false)}
        title="Danger Zone: Delete All Products"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleDeleteAllProducts} className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-950">Irreversible Catalog Wipe</p>
              <p className="mt-1 leading-relaxed">
                This will permanently delete ALL product definitions, stock batches in Store & Dispensary, and transfer logs. Categories and sales ledgers will be preserved.
              </p>
            </div>
          </div>

          {deleteAllError && (
            <Alert variant="error" onClose={() => setDeleteAllError(null)}>
              {deleteAllError}
            </Alert>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              1. Type confirmation phrase <strong className="font-mono text-rose-700">"DELETE ALL PRODUCTS"</strong>:
            </label>
            <Input
              value={deleteAllConfirmPhrase}
              onChange={(e) => setDeleteAllConfirmPhrase(e.target.value)}
              placeholder="DELETE ALL PRODUCTS"
              required
              autoFocus
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              2. Enter your Administrator Account Password:
            </label>
            <Input
              type="password"
              value={deleteAllPassword}
              onChange={(e) => setDeleteAllPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteAllModalOpen(false)}
              disabled={deleteAllLoading}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={deleteAllLoading}
              disabled={
                deleteAllLoading ||
                deleteAllConfirmPhrase.trim().toUpperCase() !== 'DELETE ALL PRODUCTS' ||
                !deleteAllPassword
              }
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-5"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Authorize & Delete All
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
