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
import { FileText, Plus, CheckCircle, Trash2, Eye } from 'lucide-react';

export const PrescriptionsPage = () => {
  const { t } = useTranslation();

  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedRx, setSelectedRx] = useState(null);

  // Form State
  const [patientId, setPatientId] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [rxItems, setRxItems] = useState([
    { product_id: '', quantity: 1, dosage: '', duration: '', instructions: '' },
  ]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`/prescriptions?${params.toString()}`);
      if (res.data.success) {
        setPrescriptions(res.data.data);
      }
    } catch (err) {
      console.error('Prescriptions load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [patRes, medRes] = await Promise.all([
          api.get('/patients?limit=100'),
          api.get('/products?product_type=MEDICINE&limit=100'),
        ]);
        if (patRes.data.success) setPatients(patRes.data.data);
        if (medRes.data.success) setMedicines(medRes.data.data);
      } catch (err) {
        console.error('Dependencies load error:', err);
      }
    };
    loadDependencies();
  }, []);

  const addRxItemRow = () => {
    setRxItems([
      ...rxItems,
      { product_id: '', quantity: 1, dosage: '', duration: '', instructions: '' },
    ]);
  };

  const updateRxItemRow = (idx, field, val) => {
    const updated = [...rxItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setRxItems(updated);
  };

  const removeRxItemRow = (idx) => {
    setRxItems(rxItems.filter((_, i) => i !== idx));
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        patient_id: patientId,
        prescribed_by: prescribedBy,
        notes,
        items: rxItems.map((i) => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity),
          dosage: i.dosage,
          duration: i.duration,
          instructions: i.instructions,
        })),
      };

      const res = await api.post('/prescriptions', payload);
      if (res.data.success) {
        setSuccessMessage(`Prescription ${res.data.data.prescription_no} created successfully`);
        setCreateModalOpen(false);
        setPatientId('');
        setPrescribedBy('');
        setNotes('');
        setRxItems([{ product_id: '', quantity: 1, dosage: '', duration: '', instructions: '' }]);
        fetchPrescriptions();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to create prescription');
    }
  };

  const handleDispense = async (rx) => {
    if (!window.confirm(`Dispense prescription ${rx.prescription_no}? This will decrement Dispensary inventory.`)) {
      return;
    }
    try {
      const res = await api.post(`/prescriptions/${rx.id}/dispense`);
      if (res.data.success) {
        setSuccessMessage(`Prescription ${rx.prescription_no} dispensed successfully`);
        fetchPrescriptions();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Dispensing failed (check dispensary stock)');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">{t('prescriptions.pending')}</Badge>;
      case 'DISPENSED':
        return <Badge variant="success">{t('prescriptions.dispensed')}</Badge>;
      case 'COMPLETED':
        return <Badge variant="info">{t('prescriptions.completed')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">{t('prescriptions.cancelled')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const columns = [
    {
      header: t('prescriptions.rx_number'),
      accessor: 'prescription_no',
      render: (row) => (
        <span className="font-mono font-semibold text-xs text-blue-600">
          {row.prescription_no}
        </span>
      ),
    },
    {
      header: t('prescriptions.patient'),
      accessor: 'patient',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800">{row.patient?.full_name}</span>
          <div className="text-xs text-slate-400">{row.patient?.phone || 'No phone'}</div>
        </div>
      ),
    },
    {
      header: t('prescriptions.doctor'),
      accessor: 'prescribed_by',
      render: (row) => row.prescribed_by || 'Dr. External',
    },
    {
      header: t('prescriptions.items_count'),
      accessor: 'items',
      render: (row) => `${row.items?.length || 0} medications`,
    },
    {
      header: t('prescriptions.status'),
      accessor: 'status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      header: t('prescriptions.date'),
      accessor: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleDateString('en-GB'),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRx(row);
              setViewModalOpen(true);
            }}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            View
          </Button>

          {row.status === 'PENDING' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDispense(row)}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              {t('prescriptions.dispense')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('prescriptions.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage patient medical orders and dispensary medication fulfillment
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="text-sm shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" />
          {t('prescriptions.create_new')}
        </Button>
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
            placeholder="Search by Rx number or patient name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            options={[
              { value: 'PENDING', label: t('prescriptions.pending') },
              { value: 'DISPENSED', label: t('prescriptions.dispensed') },
              { value: 'COMPLETED', label: t('prescriptions.completed') },
              { value: 'CANCELLED', label: t('prescriptions.cancelled') },
            ]}
          />
        </div>
      </div>

      <Table columns={columns} data={prescriptions} isLoading={loading} />

      {/* Create Prescription Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('prescriptions.create_new')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreatePrescription} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('prescriptions.patient')}
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Select Patient"
              options={patients.map((p) => ({ value: p.id, label: `${p.full_name} (${p.phone || 'No phone'})` }))}
            />
            <Input
              label={t('prescriptions.doctor')}
              placeholder="e.g. Dr. Haile Selassie"
              value={prescribedBy}
              onChange={(e) => setPrescribedBy(e.target.value)}
            />
          </div>

          {/* Rx Items Dynamic Rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Prescribed Medications
              </label>
              <button
                type="button"
                onClick={addRxItemRow}
                className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Medication
              </button>
            </div>

            {rxItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Medication #{idx + 1}</span>
                  {rxItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRxItemRow(idx)}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Select
                      required
                      value={item.product_id}
                      onChange={(e) => updateRxItemRow(idx, 'product_id', e.target.value)}
                      placeholder="Select Medicine"
                      options={medicines.map((m) => ({ value: m.id, label: `${m.name} (${m.strength || ''})` }))}
                    />
                  </div>
                  <Input
                    type="number"
                    min="1"
                    required
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateRxItemRow(idx, 'quantity', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Dosage (e.g. 1 tab 3x daily)"
                    value={item.dosage}
                    onChange={(e) => updateRxItemRow(idx, 'dosage', e.target.value)}
                  />
                  <Input
                    placeholder="Duration (e.g. 5 days)"
                    value={item.duration}
                    onChange={(e) => updateRxItemRow(idx, 'duration', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <Input
            label="Additional Notes / Clinical Advice"
            placeholder="Special instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button type="submit" className="w-full py-2.5 font-bold mt-2">
            Create Prescription Order
          </Button>
        </form>
      </Modal>

      {/* View Prescription Details Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Prescription: ${selectedRx?.prescription_no}`}
        maxWidth="max-w-lg"
      >
        {selectedRx && (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-semibold text-slate-800">{selectedRx.patient?.full_name}</p>
                <p className="text-xs text-slate-400">Allergies: {selectedRx.patient?.allergies || 'None reported'}</p>
              </div>
              <div>{getStatusBadge(selectedRx.status)}</div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Prescribed Items
              </h5>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl p-2">
                {selectedRx.items?.map((item, i) => (
                  <div key={i} className="py-2 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-900">{item.product?.name}</span>
                      <p className="text-xs text-slate-500">
                        {item.dosage} • {item.duration}
                      </p>
                    </div>
                    <span className="font-bold text-slate-800">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedRx.notes && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Doctor Notes
                </h5>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg">
                  {selectedRx.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
