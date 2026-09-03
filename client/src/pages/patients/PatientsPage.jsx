import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { Users, Plus, Eye, Phone, Calendar, HeartPulse } from 'lucide-react';

export const PatientsPage = () => {
  const { t } = useTranslation();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState({ prescriptions: [], purchases: [] });
  const [historyTab, setHistoryTab] = useState('RX'); // 'RX', 'PURCHASES'

  const [formData, setFormData] = useState({
    full_name: '',
    full_name_am: '',
    phone: '',
    gender: 'MALE',
    date_of_birth: '',
    address: '',
    allergies: '',
    notes: '',
  });

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`/patients?${params.toString()}`);
      if (res.data.success) {
        setPatients(res.data.data);
      }
    } catch (err) {
      console.error('Patients load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [searchQuery]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/patients', formData);
      if (res.data.success) {
        setSuccessMessage('Patient registered successfully');
        setCreateModalOpen(false);
        setFormData({
          full_name: '',
          full_name_am: '',
          phone: '',
          gender: 'MALE',
          date_of_birth: '',
          address: '',
          allergies: '',
          notes: '',
        });
        fetchPatients();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to create patient');
    }
  };

  const openPatientHistory = async (patient) => {
    setSelectedPatient(patient);
    setHistoryModalOpen(true);
    try {
      const [rxRes, purRes] = await Promise.all([
        api.get(`/patients/${patient.id}/prescriptions`),
        api.get(`/patients/${patient.id}/purchases`),
      ]);
      setPatientHistory({
        prescriptions: rxRes.data.data || [],
        purchases: purRes.data.data || [],
      });
    } catch (err) {
      console.error('Patient history load error:', err);
    }
  };

  const columns = [
    {
      header: t('patients.name'),
      accessor: 'full_name',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900">{row.full_name}</span>
          {row.full_name_am && <div className="text-xs text-blue-600">{row.full_name_am}</div>}
        </div>
      ),
    },
    {
      header: t('patients.phone'),
      accessor: 'phone',
      render: (row) => row.phone || '—',
    },
    {
      header: t('patients.gender'),
      accessor: 'gender',
      render: (row) => row.gender || '—',
    },
    {
      header: t('patients.allergies'),
      accessor: 'allergies',
      render: (row) =>
        row.allergies ? (
          <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">
            {row.allergies}
          </span>
        ) : (
          <span className="text-xs text-slate-400">None</span>
        ),
    },
    {
      header: 'History Records',
      accessor: '_count',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row._count?.prescriptions || 0} Rx • {row._count?.sales || 0} Sales
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => openPatientHistory(row)}>
          <Eye className="w-3.5 h-3.5 mr-1" />
          {t('patients.history')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('patients.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage patient demographic records, known allergies, and clinical histories
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="text-sm shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" />
          {t('patients.add_patient')}
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

      {/* Search Input */}
      <div className="w-full sm:w-96">
        <Input
          placeholder="Search patient by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Table columns={columns} data={patients} isLoading={loading} />

      {/* Register Patient Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('patients.add_patient')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreatePatient} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('patients.name')}
              required
              placeholder="e.g. Dawit Mekonnen"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
            <Input
              label={t('patients.name_am')}
              placeholder="e.g. ዳዊት መኮንን"
              value={formData.full_name_am}
              onChange={(e) => setFormData({ ...formData, full_name_am: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={t('patients.phone')}
              placeholder="+2519..."
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Select
              label={t('patients.gender')}
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              options={[
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Input
              label={t('patients.dob')}
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            />
          </div>

          <Input
            label={t('patients.allergies')}
            placeholder="e.g. Penicillin, Sulfa drugs, Aspirin"
            value={formData.allergies}
            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          />

          <Input
            label="Address / Subcity"
            placeholder="e.g. Bole Subcity, Woreda 03"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label="Clinical / Patient Notes"
            placeholder="Chronic conditions, medical notes..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <Button type="submit" className="w-full py-2.5 font-bold mt-2">
            Save Patient Profile
          </Button>
        </form>
      </Modal>

      {/* Patient History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Medical & Purchase History: ${selectedPatient?.full_name}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setHistoryTab('RX')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 ${
                historyTab === 'RX' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
              }`}
            >
              Prescriptions ({patientHistory.prescriptions.length})
            </button>
            <button
              onClick={() => setHistoryTab('PURCHASES')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 ${
                historyTab === 'PURCHASES' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
              }`}
            >
              Purchases ({patientHistory.purchases.length})
            </button>
          </div>

          {historyTab === 'RX' ? (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {patientHistory.prescriptions.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No prescription history</p>
              ) : (
                patientHistory.prescriptions.map((rx) => (
                  <div key={rx.id} className="py-3 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="font-mono text-blue-600">{rx.prescription_no}</span>
                      <span>{new Date(rx.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      {rx.items?.map((i) => `${i.product?.name} (x${i.quantity})`).join(', ')}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {patientHistory.purchases.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No purchase history</p>
              ) : (
                patientHistory.purchases.map((sale) => (
                  <div key={sale.id} className="py-3 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold text-slate-800">{sale.sale_number}</span>
                      <p className="text-slate-500">{new Date(sale.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <span className="font-bold text-slate-900">
                      {parseFloat(sale.total_amount).toFixed(2)} ETB
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
