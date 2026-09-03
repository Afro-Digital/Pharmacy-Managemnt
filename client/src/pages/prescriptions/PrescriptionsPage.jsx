import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import api, { resolveAssetUrl } from '../../services/api';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import {
  FileText,
  Plus,
  CheckCircle,
  Trash2,
  Eye,
  QrCode,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
  Camera,
  X,
} from 'lucide-react';

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
  const [imagePreviewModalOpen, setImagePreviewModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);

  // QR Upload State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSessionId, setQrSessionId] = useState(null);
  const [qrSessionUrl, setQrSessionUrl] = useState('');
  const [qrStatus, setQrStatus] = useState('PENDING'); // 'PENDING' | 'UPLOADED'
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const pollingRef = useRef(null);

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

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Start QR session
  const handleOpenQRModal = async () => {
    try {
      setQrStatus('PENDING');
      setUploadedImageUrl(null);
      setCopiedLink(false);

      const res = await api.post('/prescriptions/upload-session');
      if (res.data.success) {
        const sid = res.data.data.sessionId;
        const fullUrl = `${window.location.origin}${res.data.data.uploadUrl}`;
        setQrSessionId(sid);
        setQrSessionUrl(fullUrl);
        setQrModalOpen(true);

        // Start polling for upload status every 2 seconds
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await api.get(`/prescriptions/upload-session/${sid}`);
            if (statusRes.data.success && statusRes.data.data.status === 'UPLOADED') {
              clearInterval(pollingRef.current);
              setQrStatus('UPLOADED');
              setUploadedImageUrl(statusRes.data.data.imageUrl);
            }
          } catch {
            // ignore temporary polling error
          }
        }, 2000);
      }
    } catch (err) {
      setErrorMessage('Failed to initialize mobile upload session');
    }
  };

  const handleCloseQRModal = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setQrModalOpen(false);
  };

  const handleUseCapturedPhoto = () => {
    handleCloseQRModal();
    // Open prescription form with image attached and prefill
    setPrescribedBy('Dr. Medical Order (Scanned)');
    setCreateModalOpen(true);
  };

  const copyToClipboard = () => {
    if (qrSessionUrl) {
      navigator.clipboard.writeText(qrSessionUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

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
      const validItems = rxItems.filter((i) => i.product_id);
      const payload = {
        patient_id: patientId || null, // Optional: No patient profile required!
        prescribed_by: prescribedBy || 'Dr. Medical Order',
        image_url: uploadedImageUrl || null,
        upload_session_id: qrSessionId || null,
        notes,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity) || 1,
          dosage: i.dosage || '',
          duration: i.duration || '',
          instructions: i.instructions || '',
        })),
      };

      const res = await api.post('/prescriptions', payload);
      if (res.data.success) {
        setSuccessMessage(`Prescription ${res.data.data.prescription_no} registered successfully`);
        setCreateModalOpen(false);
        setPatientId('');
        setPrescribedBy('');
        setNotes('');
        setUploadedImageUrl(null);
        setQrSessionId(null);
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
        <div className="flex items-center space-x-2">
          <span className="font-mono font-semibold text-xs text-blue-600">
            {row.prescription_no}
          </span>
          {row.image_url && (
            <button
              onClick={() => {
                setSelectedImageUrl(resolveAssetUrl(row.image_url));
                setImagePreviewModalOpen(true);
              }}
              className="p-1 rounded-md bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
              title="View Scanned Prescription Photo"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
    {
      header: t('prescriptions.patient'),
      accessor: 'patient',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800">
            {row.patient?.full_name || <span className="text-slate-400 italic">No patient profile</span>}
          </span>
          <div className="text-xs text-slate-400">{row.patient?.phone || 'Direct Rx Scan'}</div>
        </div>
      ),
    },
    {
      header: t('prescriptions.doctor'),
      accessor: 'prescribed_by',
      render: (row) => row.prescribed_by || 'Dr. Medical Order',
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
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('prescriptions.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Capture prescriptions via WebQR mobile camera or register digital doctor orders
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleOpenQRModal}
            className="bg-purple-600 hover:bg-purple-700 text-sm shadow-sm text-white"
          >
            <QrCode className="w-4 h-4 mr-1.5" />
            Scan via Mobile QR
          </Button>
          <Button
            onClick={() => {
              setUploadedImageUrl(null);
              setCreateModalOpen(true);
            }}
            className="text-sm shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('prescriptions.create_new')}
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

      {/* ========================================================================= */}
      {/* WebQR Code Prescription Capture Modal                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={qrModalOpen}
        onClose={handleCloseQRModal}
        title="Capture Prescription via Mobile Camera"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-center">
          {qrStatus === 'PENDING' ? (
            <>
              <p className="text-xs text-slate-500">
                Scan this QR code with any smartphone camera to open the uploader.
                <br />
                <strong className="text-slate-800">No app installation or patient profile required.</strong>
              </p>

              {/* QR Code Container */}
              <div className="flex justify-center p-4 bg-white border-2 border-slate-200/80 rounded-2xl shadow-inner inline-block mx-auto">
                {qrSessionUrl && (
                  <QRCodeSVG
                    value={qrSessionUrl}
                    size={210}
                    level="H"
                    includeMargin
                    className="rounded-lg"
                  />
                )}
              </div>

              {/* Live Polling Indicator */}
              <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-purple-600 bg-purple-50 py-2 px-3 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                <span>Waiting for mobile camera capture...</span>
              </div>

              {/* Direct Link Alternative */}
              <div className="flex items-center space-x-2 pt-1">
                <Input
                  value={qrSessionUrl}
                  readOnly
                  className="text-xs font-mono bg-slate-50 text-slate-600"
                />
                <Button variant="outline" size="sm" onClick={copyToClipboard} title="Copy upload link">
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
                <a
                  href={qrSessionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                  title="Open in new tab for testing"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </>
          ) : (
            /* Uploaded State */
            <div className="space-y-4 py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Prescription Photo Received!</h4>
                <p className="text-xs text-slate-500 mt-0.5">Photo has been securely uploaded from the mobile device.</p>
              </div>

              {uploadedImageUrl && (
                <div className="max-h-56 overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                  <img src={uploadedImageUrl} alt="Uploaded prescription" className="w-full h-full object-contain" />
                </div>
              )}

              <Button
                onClick={handleUseCapturedPhoto}
                className="w-full py-2.5 font-bold bg-blue-600 hover:bg-blue-700"
              >
                Proceed to Select Medications & Fulfill
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* Create Prescription Modal (Supports photo attachment & optional patient)    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={uploadedImageUrl ? 'Fulfill Scanned Prescription' : t('prescriptions.create_new')}
        maxWidth={uploadedImageUrl ? 'max-w-4xl' : 'max-w-2xl'}
      >
        <form onSubmit={handleCreatePrescription} className="space-y-4">
          <div className={`grid gap-4 ${uploadedImageUrl ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Left side: Photo Preview if uploaded via QR */}
            {uploadedImageUrl && (
              <div className="bg-slate-900 rounded-2xl overflow-hidden p-2 flex flex-col justify-between max-h-[500px]">
                <div className="flex justify-between items-center px-2 py-1 text-slate-300 text-xs">
                  <span className="font-semibold flex items-center">
                    <Camera className="w-3.5 h-3.5 mr-1" /> Scanned Doctor Slip
                  </span>
                  <a href={uploadedImageUrl} target="_blank" rel="noreferrer" className="hover:text-white flex items-center">
                    <ExternalLink className="w-3 h-3 mr-0.5" /> Full Size
                  </a>
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center p-1">
                  <img src={uploadedImageUrl} alt="Prescription" className="max-h-[420px] object-contain rounded-lg" />
                </div>
              </div>
            )}

            {/* Right side (or full width): Clinical Prescription Form */}
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label={`${t('prescriptions.patient')} (Optional)`}
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="Select Patient or Leave Blank (No Profile Needed)"
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
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Prescribed Medications
                  </label>
                  <button
                    type="button"
                    onClick={addRxItemRow}
                    className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Medicine
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {rxItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">Medication #{idx + 1}</span>
                        {rxItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRxItemRow(idx)}
                            className="text-[11px] text-rose-500 hover:text-rose-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <Select
                            value={item.product_id}
                            onChange={(e) => updateRxItemRow(idx, 'product_id', e.target.value)}
                            placeholder="Select Medicine"
                            options={medicines.map((m) => ({ value: m.id, label: `${m.name} (${m.strength || ''})` }))}
                          />
                        </div>
                        <Input
                          type="number"
                          min="1"
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
              </div>

              <Input
                label="Clinical Notes / Diagnosis"
                placeholder="Additional instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <Button type="submit" className="w-full py-2.5 font-bold mt-2">
                Save Prescription Order
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Full Size Image Viewer Modal */}
      <Modal
        isOpen={imagePreviewModalOpen}
        onClose={() => setImagePreviewModalOpen(false)}
        title="Scanned Prescription Slip"
        maxWidth="max-w-2xl"
      >
        <div className="p-2 bg-slate-900 rounded-xl flex items-center justify-center">
          {selectedImageUrl && (
            <img src={selectedImageUrl} alt="Prescription Full Size" className="max-h-[75vh] object-contain rounded-lg" />
          )}
        </div>
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
                <p className="font-semibold text-slate-800">
                  {selectedRx.patient?.full_name || 'Walk-In / Direct Prescription'}
                </p>
                <p className="text-xs text-slate-400">
                  Doctor: {selectedRx.prescribed_by || 'Dr. External'}
                </p>
              </div>
              <div>{getStatusBadge(selectedRx.status)}</div>
            </div>

            {selectedRx.image_url && (
              <div className="p-2 border border-slate-200 rounded-xl bg-slate-50 text-center">
                <span className="text-xs font-semibold text-slate-700 block mb-1.5">Attached Prescription Photo:</span>
                <img
                  src={resolveAssetUrl(selectedRx.image_url)}
                  alt="Prescription"
                  className="max-h-48 mx-auto object-contain rounded-lg cursor-pointer hover:opacity-95"
                  onClick={() => {
                    setSelectedImageUrl(resolveAssetUrl(selectedRx.image_url));
                    setImagePreviewModalOpen(true);
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Prescribed Items
              </h5>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl p-2">
                {selectedRx.items?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No digital line items attached</p>
                ) : (
                  selectedRx.items?.map((item, i) => (
                    <div key={i} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-900">{item.product?.name}</span>
                        <p className="text-xs text-slate-500">
                          {item.dosage} • {item.duration}
                        </p>
                      </div>
                      <span className="font-bold text-slate-800">x{item.quantity}</span>
                    </div>
                  ))
                )}
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
