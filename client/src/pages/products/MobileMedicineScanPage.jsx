import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Pill,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ScanBarcode,
  Calendar,
  Layers,
  ChevronRight,
  Laptop,
  Clock,
  Loader2,
  Edit3,
  Save,
} from 'lucide-react';
import { API_BASE } from '../../services/api';

// Smart Expiry Date Normalizer: supports YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, "07 2027", "EXP 07/2027", "07/27", Excel serials, textual dates
const normalizeExpiryDateString = (rawInput) => {
  if (!rawInput && rawInput !== 0) return null;
  let str = String(rawInput).trim();
  if (!str) return null;

  // Clean common prefixes
  str = str.replace(/^(?:exp(?:iry|\.|\b)?|bb(?:d)?|best\s*before|use\s*by|mfg|lot)[:.\s]*/i, '').trim();

  // 1. Excel serial number (30000 - 70000)
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 30000 && num <= 70000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD or YYYY MM DD
  const ymdMatch = str.match(/^(\d{4})[-/.\s]+(\d{1,2})[-/.\s]+(\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. DD-MM-YYYY or MM-DD-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    let day = p1, month = p2;
    if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
    else if (p2 > 12 && p1 <= 12) { month = p1; day = p2; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. DD-MM-YY with 2-digit year
  const dmy2Match = str.match(/^(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{2})$/);
  if (dmy2Match) {
    const p1 = parseInt(dmy2Match[1], 10);
    const p2 = parseInt(dmy2Match[2], 10);
    const y = 2000 + parseInt(dmy2Match[3], 10);
    let day = p1, month = p2;
    if (p1 > 12 && p2 <= 12) { day = p1; month = p2; }
    else if (p2 > 12 && p1 <= 12) { month = p1; day = p2; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 5. Month & Year: "07 2027", "07/2027", "07-2027", "7 2027"
  const myMatch = str.match(/^(\d{1,2})[-/.\s]+(\d{4})$/);
  if (myMatch) {
    const m = parseInt(myMatch[1], 10);
    const y = parseInt(myMatch[2], 10);
    if (m >= 1 && m <= 12 && y >= 1990 && y <= 2100) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 6. Year & Month: "2027 07", "2027/07", "2027-07"
  const ymMatch = str.match(/^(\d{4})[-/.\s]+(\d{1,2})$/);
  if (ymMatch) {
    const y = parseInt(ymMatch[1], 10);
    const m = parseInt(ymMatch[2], 10);
    if (m >= 1 && m <= 12 && y >= 1990 && y <= 2100) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 7. 2-digit month & 2-digit year: "07/27", "07 27", "07-27"
  const my2Match = str.match(/^(\d{1,2})[-/.\s]+(\d{2})$/);
  if (my2Match) {
    const m = parseInt(my2Match[1], 10);
    const y = 2000 + parseInt(my2Match[2], 10);
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2099) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 8. Textual month: "Jul 2027", "July 2027", "JUL 27"
  const monthNames = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const textMonthMatch = str.match(/([a-zA-Z]{3,9})[-/.\s]+(\d{2,4})|(\d{2,4})[-/.\s]+([a-zA-Z]{3,9})/i);
  if (textMonthMatch) {
    const mStr = (textMonthMatch[1] || textMonthMatch[4]).toLowerCase().substring(0, 3);
    let y = parseInt(textMonthMatch[2] || textMonthMatch[3], 10);
    if (y < 100) y += 2000;
    const m = monthNames[mStr];
    if (m && y >= 1990 && y <= 2100) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // 9. Standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1990 && y <= 2100) {
      return `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  return null;
};

export const MobileMedicineScanPage = () => {
  const { sessionId } = useParams();

  // Navigation Stage: 1 = Barcode, 2 = Expiry & Batch, 3 = Complete / Live Sync
  const [currentStage, setCurrentStage] = useState(1);

  // Connection status
  const [connected, setConnected] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [categories, setCategories] = useState([]);

  // Stage 1 State (Product Packaging)
  const [stage1File, setStage1File] = useState(null);
  const [stage1Preview, setStage1Preview] = useState(null);
  const [stage1ManualBarcode, setStage1ManualBarcode] = useState('');
  const [stage1Uploading, setStage1Uploading] = useState(false);
  const [stage1Submitted, setStage1Submitted] = useState(false);

  // Stage 2 State (Expiry & Batch)
  const [stage2File, setStage2File] = useState(null);
  const [stage2Preview, setStage2Preview] = useState(null);
  const [stage2Uploading, setStage2Uploading] = useState(false);
  const [stage2Submitted, setStage2Submitted] = useState(false);

  // Status & Error
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Refs for camera / file inputs
  const stage1CameraRef = useRef(null);
  const stage1GalleryRef = useRef(null);
  const stage2CameraRef = useRef(null);
  const stage2GalleryRef = useRef(null);

  // Notify user briefly
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch categories on mount for Stage 3 manual dropdown
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await axios.get(`${API_BASE}/categories`);
        if (res.data?.success && res.data?.data) {
          setCategories(res.data.data);
        }
      } catch (err) {
        // Silently ignore category fetch error on mobile
      }
    };
    fetchCats();
  }, []);

  // 1. On Mount: Connect to Desktop Session
  useEffect(() => {
    let isMounted = true;

    const connectToDesktop = async () => {
      try {
        const res = await axios.post(`${API_BASE}/vision/scan-session/${sessionId}/connect`);
        if (isMounted && res.data.success) {
          setConnected(true);
          setSessionData(res.data.data);
        }
      } catch (err) {
        console.warn('Could not register phone handshake:', err);
      }
    };

    if (sessionId) {
      connectToDesktop();
    }

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const [reconnecting, setReconnecting] = useState(false);
  const consecutiveErrorsRef = useRef(0);

  // 2. Poll session status every 1.5s for real-time sync with desktop
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/vision/scan-session/${sessionId}`);
        consecutiveErrorsRef.current = 0;
        setReconnecting(false);

        if (res.data.success && res.data.data) {
          const s = res.data.data;
          setSessionData(s);
          if (s.phoneConnected) setConnected(true);

          // If stage 2 is complete while on stage 2, auto-advance to stage 3
          if (s.stage2?.status === 'COMPLETED' && currentStage === 2) {
            setStage2Submitted(true);
            showToast('✓ Batch No. & Expiry Date captured! Moving to Stage 3...');
            setTimeout(() => {
              setCurrentStage(3);
            }, 600);
          }
        }
      } catch (e) {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 2) {
          setReconnecting(true);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sessionId, currentStage]);

  // Stage 3 Comprehensive Editable State (for manual adjustment when user is not satisfied)
  const [stage3EditMode, setStage3EditMode] = useState(false);
  const [stage3Form, setStage3Form] = useState({
    name: '',
    name_am: '',
    product_type: 'MEDICINE',
    category_id: '',
    requires_prescription: false,
    dosage_form: '',
    strength: '',
    unit: 'strip',
    generic_name: '',
    brand: '',
    manufacturer: '',
    batch_number: '',
    expiry_date: '',
  });
  const [stage3Saving, setStage3Saving] = useState(false);

  useEffect(() => {
    if (sessionData?.productData && !stage3EditMode) {
      setStage3Form({
        name: sessionData.productData.name || '',
        name_am: sessionData.productData.name_am || '',
        product_type: sessionData.productData.product_type || 'MEDICINE',
        category_id: sessionData.productData.category_id || '',
        requires_prescription: Boolean(sessionData.productData.requires_prescription),
        dosage_form: sessionData.productData.dosage_form || '',
        strength: sessionData.productData.strength || '',
        unit: sessionData.productData.unit || 'strip',
        generic_name: sessionData.productData.generic_name || '',
        brand: sessionData.productData.brand || '',
        manufacturer: sessionData.productData.manufacturer || '',
        batch_number: sessionData.productData.batch_number || '',
        expiry_date: normalizeExpiryDateString(sessionData.productData.expiry_date) || sessionData.productData.expiry_date || '',
      });
    }
  }, [sessionData?.productData, stage3EditMode]);

  const handleStage3Save = async () => {
    setStage3Saving(true);
    setErrorMessage(null);
    try {
      const res = await axios.patch(`${API_BASE}/vision/scan-session/${sessionId}/fields`, stage3Form);
      if (res.data?.success && res.data?.data?.productData) {
        setSessionData((prev) => ({
          ...prev,
          productData: { ...(prev?.productData || {}), ...res.data.data.productData },
        }));
        showToast('✓ Information updated and synced to desktop!');
        setStage3EditMode(false);
      }
    } catch (err) {
      setErrorMessage('Failed to save manual changes. Please try again.');
    } finally {
      setStage3Saving(false);
    }
  };

  // Submit Stage 1 Packaging photo & auto-advance to Stage 2
  const handleStage1Submit = async (overrideFile) => {
    const fileToUpload = overrideFile || stage1File;
    if (!fileToUpload && !stage1ManualBarcode.trim()) {
      setErrorMessage('Please snap a photo of the medicine box or type the barcode numbers.');
      return;
    }

    setStage1Uploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      if (fileToUpload) {
        formData.append('image', fileToUpload);
      }
      if (stage1ManualBarcode.trim()) {
        formData.append('barcode', stage1ManualBarcode.trim());
      }

      const res = await axios.post(`${API_BASE}/vision/scan-session/${sessionId}/stage1-barcode`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStage1Submitted(true);
      if (res.data?.data?.productData) {
        setSessionData((prev) => ({
          ...prev,
          productData: { ...(prev?.productData || {}), ...res.data.data.productData },
          stage1: { ...(prev?.stage1 || {}), status: 'COMPLETED' },
        }));
      }

      showToast('✨ Stage 1 Complete! Auto-filled product details. Moving to Stage 2...');

      // AUTOMATIC PROGRESSION: Advance to Stage 2 automatically upon scan completion
      setTimeout(() => {
        setCurrentStage(2);
      }, 900);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to submit photo. Please try again.';
      setErrorMessage(msg);
    } finally {
      setStage1Uploading(false);
    }
  };

  // Handle Stage 1 file selection (Barcode / Packaging) -> auto-trigger analysis
  const handleStage1FileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage1File(file);
    setStage1Preview(URL.createObjectURL(file));
    setErrorMessage(null);
    // Auto-trigger scan immediately upon photo capture!
    handleStage1Submit(file);
  };

  // Submit Stage 2 Expiry/Batch & auto-advance to Stage 3
  const handleStage2Submit = async (overrideFile) => {
    const fileToUpload = overrideFile || stage2File;
    if (!fileToUpload) {
      setErrorMessage('Please take a clear photo of the expiry date and batch number stamp.');
      return;
    }

    setStage2Uploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', fileToUpload);

      // Backend returns 202 Accepted immediately
      await axios.post(`${API_BASE}/vision/scan-session/${sessionId}/stage2-expiry`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStage2Submitted(true);
      showToast('🚀 Expiry & Batch scan submitted! Moving to Stage 3...');

      // AUTOMATIC PROGRESSION: Advance to Stage 3 automatically
      setTimeout(() => {
        setCurrentStage(3);
      }, 700);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to upload photo. Please retry.';
      setErrorMessage(msg);
    } finally {
      setStage2Uploading(false);
    }
  };

  // Handle Stage 2 file selection (Expiry & Batch) -> auto-trigger analysis
  const handleStage2FileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage2File(file);
    setStage2Preview(URL.createObjectURL(file));
    setErrorMessage(null);
    // Auto-trigger submission immediately upon photo capture!
    handleStage2Submit(file);
  };

  // Reset to scan another medicine
  const handleScanAnother = () => {
    setStage1File(null);
    setStage1Preview(null);
    setStage1ManualBarcode('');
    setStage1Submitted(false);

    setStage2File(null);
    setStage2Preview(null);
    setStage2Submitted(false);

    setErrorMessage(null);
    setCurrentStage(1);
    if (stage1CameraRef.current) stage1CameraRef.current.value = '';
    if (stage1GalleryRef.current) stage1GalleryRef.current.value = '';
    if (stage2CameraRef.current) stage2CameraRef.current.value = '';
    if (stage2GalleryRef.current) stage2GalleryRef.current.value = '';
  };

  const productData = sessionData?.productData || {};
  const stage1 = sessionData?.stage1 || {};
  const stage2 = sessionData?.stage2 || {};

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-5 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-violet-600 text-white font-semibold text-xs py-2.5 px-4 rounded-full shadow-2xl flex items-center gap-2 border border-violet-400/30 animate-bounce">
          <Sparkles className="w-4 h-4 text-violet-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="w-full max-w-md mx-auto pt-1 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-900/40 flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                TilexPharmacy
              </h1>
              <p className="text-[11px] text-slate-400">Two-Stage Intake Engine</p>
            </div>
          </div>

          {/* Desktop Connection Badge */}
          <div
            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              reconnecting
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 animate-pulse'
                : connected
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-950/80 text-amber-400 border-amber-500/40 animate-pulse'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>{reconnecting ? 'Reconnecting...' : connected ? 'Desktop Connected' : 'Connecting...'}</span>
          </div>
        </div>

        {/* 3-Stage Step Navigation Indicator */}
        <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 shadow-inner">
          {/* Stage 1 Pill */}
          <button
            type="button"
            onClick={() => setCurrentStage(1)}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 transition-all ${
              currentStage === 1
                ? 'bg-violet-600 text-white shadow-md'
                : stage1.status === 'COMPLETED' || stage1Submitted
                ? 'bg-emerald-950/40 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {stage1.status === 'COMPLETED' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Stage 1</span>
            </div>
            <span className="text-[9px] opacity-80 leading-none">Product Image</span>
          </button>

          {/* Stage 2 Pill */}
          <button
            type="button"
            onClick={() => setCurrentStage(2)}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 transition-all ${
              currentStage === 2
                ? 'bg-violet-600 text-white shadow-md'
                : stage2.status === 'COMPLETED' || stage2Submitted
                ? 'bg-emerald-950/40 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {stage2.status === 'COMPLETED' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              <span>Stage 2</span>
            </div>
            <span className="text-[9px] opacity-80 leading-none">Expiry / Batch</span>
          </button>

          {/* Stage 3 Pill */}
          <button
            type="button"
            onClick={() => setCurrentStage(3)}
            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 transition-all ${
              currentStage === 3
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1 text-[11px] font-bold">
              <Laptop className="w-3.5 h-3.5" />
              <span>Stage 3</span>
            </div>
            <span className="text-[9px] opacity-80 leading-none">Desktop Sync</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Card */}
      <main className="w-full max-w-md mx-auto bg-white text-slate-900 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col justify-between my-1">
        {/* ─── STAGE 1: BARCODE SCAN ─── */}
        {currentStage === 1 && (
          <div className="h-full flex flex-col justify-between space-y-4">
            <div>
              <div className="text-center mb-3">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-bold mb-2 shadow-md shadow-violet-600/30">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
                  Stage 1: Capture Entire Product Image
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Point camera at the <strong>entire medicine box or bottle</strong> (showing medicine name, strength & details). Our AI extracts all information including expiry date automatically!
                </p>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={stage1CameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleStage1FileChange}
              />
              <input
                ref={stage1GalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleStage1FileChange}
              />

              {stage1Preview ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-violet-300 bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-md">
                    <img
                      src={stage1Preview}
                      alt="Packaging snap"
                      className="w-full h-full object-contain"
                    />
                    {/* Reticle Overlay */}
                    <div className="absolute inset-3 border border-white/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                      <div className="flex justify-between">
                        <div className="w-5 h-5 border-t-2 border-l-2 border-violet-400 rounded-tl" />
                        <div className="w-5 h-5 border-t-2 border-r-2 border-violet-400 rounded-tr" />
                      </div>
                      <div className="flex justify-between">
                        <div className="w-5 h-5 border-b-2 border-l-2 border-violet-400 rounded-bl" />
                        <div className="w-5 h-5 border-b-2 border-r-2 border-violet-400 rounded-br" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                      AI Product Scan Ready
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={stage1Uploading}
                      onClick={() => stage1CameraRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake
                    </button>
                    <button
                      type="button"
                      disabled={stage1Uploading}
                      onClick={() => stage1GalleryRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Gallery
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Entire Product Snap Box */}
                  <button
                    type="button"
                    onClick={() => stage1CameraRef.current?.click()}
                    className="relative w-full py-8 px-4 rounded-2xl border-2 border-dashed border-violet-400 bg-gradient-to-b from-violet-50/70 to-indigo-50/50 hover:bg-violet-50 text-violet-700 flex flex-col items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-xs group"
                  >
                    {/* Viewfinder corner brackets */}
                    <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-violet-600 rounded-tl pointer-events-none" />
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-violet-600 rounded-tr pointer-events-none" />
                    <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-violet-600 rounded-bl pointer-events-none" />
                    <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-violet-600 rounded-br pointer-events-none" />

                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold block text-slate-900">
                        📸 Snap Entire Product Packaging
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block max-w-xs">
                        Frame the entire box or bottle (name, strength & details)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => stage1GalleryRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    Upload product photo from gallery
                  </button>

                  {/* Manual Barcode Fallback */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                      Or type barcode digits (optional if visible):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 8901234567890"
                      value={stage1ManualBarcode}
                      onChange={(e) => setStage1ManualBarcode(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {/* Stage 1 AI Extraction Results Card */}
              {stage1Submitted && (productData.name || sessionData?.productData?.name) && (
                <div className="mt-3 p-3.5 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl text-slate-900 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                    <div className="flex items-center gap-1.5 font-extrabold text-xs text-emerald-800">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Stage 1 Details Extracted & Auto-Filled!</span>
                    </div>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                      10 Fields Ready
                    </span>
                  </div>

                  {/* 1. Product Name & INN */}
                  <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/80 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Product Name *
                    </span>
                    <p className="text-sm font-black text-slate-900 leading-snug">
                      {productData.name || sessionData?.productData?.name}
                    </p>
                    {(productData.generic_name || sessionData?.productData?.generic_name) && (
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        <span className="font-semibold text-slate-700">Generic / INN:</span> {productData.generic_name || sessionData?.productData?.generic_name}
                      </p>
                    )}
                  </div>

                  {/* 2. Grid of 8 Core Fields */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Product Type *</span>
                      <span className="font-bold text-slate-800">
                        {productData.product_type || sessionData?.productData?.product_type || 'Medicine'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Rx Prescription *</span>
                      <span className={`font-bold ${productData.requires_prescription || sessionData?.productData?.requires_prescription ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {productData.requires_prescription || sessionData?.productData?.requires_prescription ? 'Yes (Rx Required)' : 'No (OTC / Over The Counter)'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Dosage Form *</span>
                      <span className="font-bold text-emerald-900">
                        {productData.dosage_form || sessionData?.productData?.dosage_form || 'Tablet'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Strength *</span>
                      <span className="font-bold text-emerald-900">
                        {productData.strength || sessionData?.productData?.strength || '—'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Packaging Unit *</span>
                      <span className="font-bold text-slate-800 capitalize">
                        {productData.unit || sessionData?.productData?.unit || 'Strip (ካርታ)'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Category</span>
                      <span className="font-bold text-indigo-900 truncate block">
                        {categories.find((c) => c.id === (productData.category_id || sessionData?.productData?.category_id))?.name ||
                          productData.category ||
                          'Auto-Matched'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Brand</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {productData.brand || sessionData?.productData?.brand || '—'}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 block">Manufacturer</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {productData.manufacturer || sessionData?.productData?.manufacturer || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Auto-progression banner */}
                  <div className="p-2.5 bg-violet-600 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Auto-moving to Stage 2: Expiry & Batch...</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStage(2)}
                      className="bg-white text-violet-900 font-bold px-2 py-0.5 rounded text-[11px] hover:bg-violet-50"
                    >
                      Next →
                    </button>
                  </div>

                  {/* Manual adjustment link if needed */}
                  <button
                    type="button"
                    onClick={() => {
                      setStage3EditMode(true);
                      setCurrentStage(3);
                    }}
                    className="w-full py-1 text-center text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Not satisfied with info? Go to Stage 3 for manual editing →
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Button for Stage 1 */}
            {(!stage1Submitted || !productData.name) && (
              <div className="pt-3">
                <button
                  type="button"
                  disabled={stage1Uploading || (!stage1File && !stage1ManualBarcode.trim())}
                  onClick={handleStage1Submit}
                  className="w-full py-3.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50"
                >
                  {stage1Uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing Entire Product with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-violet-200" />
                      <span>Analyze Product Image & Auto-Fill</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStage(2)}
                  className="w-full text-center text-xs text-slate-500 hover:text-violet-600 font-medium mt-2 py-1"
                >
                  Skip to Stage 2 (Close-up Expiry Stamp) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── STAGE 2: EXPIRY & BATCH CAPTURE ─── */}
        {currentStage === 2 && (
          <div className="h-full flex flex-col justify-between space-y-4">
            <div>
              {/* Async Non-blocking Banner */}
              {stage1.status === 'PROCESSING' && (
                <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
                  <span className="leading-tight">
                    <strong>Stage 1 is processing in background!</strong> You can take this expiry picture immediately without waiting.
                  </span>
                </div>
              )}

              {stage1.status === 'COMPLETED' && (
                <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Product: <strong>{productData.name || 'Identified'}</strong></span>
                  </div>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    Stage 1 Done
                  </span>
                </div>
              )}

              {/* Auto-detected Expiry from Stage 1 packaging */}
              {productData.expiry_date && (
                <div className="mb-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Expiry Date Auto-Detected!</span>
                    </div>
                    <span className="font-mono font-bold text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                      {normalizeExpiryDateString(productData.expiry_date) || productData.expiry_date}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 mb-2.5">
                    AI extracted the expiry date from your product packaging. You can proceed directly to desktop sync or take a close-up photo to confirm.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStage(3)}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Use Auto-Detected Expiry & Finish Intake</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="text-center mb-3">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 font-bold mb-2">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Stage 2: Expiry & Batch Verification
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Point camera at the printed stamp showing <strong>EXP date</strong> and <strong>Batch/Lot No.</strong> (optional if already detected)
                </p>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={stage2CameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleStage2FileChange}
              />
              <input
                ref={stage2GalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleStage2FileChange}
              />

              {stage2Preview ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-200 bg-slate-950 aspect-[4/3] flex items-center justify-center shadow-md">
                    <img
                      src={stage2Preview}
                      alt="Expiry snap"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-medium flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      Expiry Stamp Ready
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={stage2Uploading}
                      onClick={() => stage2CameraRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake
                    </button>
                    <button
                      type="button"
                      disabled={stage2Uploading}
                      onClick={() => stage2GalleryRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Gallery
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => stage2CameraRef.current?.click()}
                    className="w-full py-8 px-4 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-400/40">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-bold block text-slate-900">
                        📸 Snap Expiry & Batch Stamp
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Focus on the stamped text (e.g. B.N. 4920 EXP 08/2027)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => stage2GalleryRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    Choose photo from gallery
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Bottom Action Button */}
            <div className="pt-3">
              <button
                type="button"
                disabled={stage2Uploading || !stage2File}
                onClick={handleStage2Submit}
                className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {stage2Uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Queuing on Server...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Submit & Sync with Desktop</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCurrentStage(1)}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium mt-2 py-1"
              >
                ← Back to Stage 1 (Product Image)
              </button>
            </div>
          </div>
        )}

        {/* ─── STAGE 3: MANUAL COMPLETION & REVIEW (IF USER IS NOT SATISFIED) ─── */}
        {currentStage === 3 && (
          <div className="h-full flex flex-col justify-between py-1 space-y-4">
            <div className="space-y-3">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center mx-auto shadow-inner mb-1">
                  <Laptop className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Stage 3: Review & Manual Adjustment
                </h2>
                <p className="text-xs text-slate-500">
                  Use this stage if you want to edit any information before saving, or complete on desktop.
                </p>
              </div>

              {/* Progress Pipeline Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    Stage 1: Product Image
                  </span>
                  <span
                    className={`font-semibold text-[11px] px-2 py-0.5 rounded ${
                      stage1.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : stage1.status === 'PROCESSING'
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {stage1.status === 'COMPLETED'
                      ? `Detected (${productData.name || 'OK'})`
                      : stage1.status === 'PROCESSING'
                      ? 'Analyzing...'
                      : 'Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Stage 2: Expiry & Batch
                  </span>
                  <span
                    className={`font-semibold text-[11px] px-2 py-0.5 rounded ${
                      stage2.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : stage2.status === 'PROCESSING'
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : stage2.status === 'QUEUED'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {stage2.status === 'COMPLETED'
                      ? 'Extracted'
                      : stage2.status === 'PROCESSING'
                      ? 'AI Extracting...'
                      : stage2.status === 'QUEUED'
                      ? 'Queued'
                      : 'Verified'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    Stage 3: Manual Completion
                  </span>
                  <span className="font-semibold text-[11px] text-violet-700 bg-violet-100 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
              </div>

              {/* Stage 3 Manual Edit Form or Live Preview */}
              {stage3EditMode ? (
                <div className="bg-slate-50 border-2 border-violet-300 rounded-2xl p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-violet-600" />
                      Edit Medicine Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setStage3EditMode(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={stage3Form.name}
                        onChange={(e) => setStage3Form({ ...stage3Form, name: e.target.value })}
                        className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        placeholder="e.g. Amoxicillin 500mg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Product Type *
                        </label>
                        <select
                          value={stage3Form.product_type}
                          onChange={(e) => setStage3Form({ ...stage3Form, product_type: e.target.value })}
                          className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                        >
                          <option value="MEDICINE">Medicine</option>
                          <option value="COSMETIC">Cosmetic</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Rx Prescription *
                        </label>
                        <select
                          value={stage3Form.requires_prescription ? 'true' : 'false'}
                          onChange={(e) => setStage3Form({ ...stage3Form, requires_prescription: e.target.value === 'true' })}
                          className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                        >
                          <option value="false">No (OTC)</option>
                          <option value="true">Yes (Rx Required)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                        Category (Optional)
                      </label>
                      <select
                        value={stage3Form.category_id}
                        onChange={(e) => setStage3Form({ ...stage3Form, category_id: e.target.value })}
                        className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                      >
                        <option value="">Select Category (Optional)</option>
                        {categories
                          .filter((c) => !stage3Form.product_type || c.type === stage3Form.product_type)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Dosage Form *
                        </label>
                        <input
                          type="text"
                          value={stage3Form.dosage_form}
                          onChange={(e) => setStage3Form({ ...stage3Form, dosage_form: e.target.value })}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                          placeholder="e.g. Capsule, Tablet, Syrup"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Strength *
                        </label>
                        <input
                          type="text"
                          value={stage3Form.strength}
                          onChange={(e) => setStage3Form({ ...stage3Form, strength: e.target.value })}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                          placeholder="e.g. 500mg, 100ml"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Packaging Unit *
                        </label>
                        <select
                          value={stage3Form.unit}
                          onChange={(e) => setStage3Form({ ...stage3Form, unit: e.target.value })}
                          className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                        >
                          <option value="strip">Strip (ካርታ)</option>
                          <option value="bottle">Bottle (ጠርሙስ)</option>
                          <option value="sachet">Sachet (ፓኬት)</option>
                          <option value="ampule">Ampule (አምፑል)</option>
                          <option value="box">Box (ካርቶን / ሳጥን)</option>
                          <option value="vial">Vial (ቫያል)</option>
                          <option value="tube">Tube (ቱቦ)</option>
                          <option value="tablet">Tablet (ኪኒን)</option>
                          <option value="jar">Jar (ማሰሮ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Generic / INN Name
                        </label>
                        <input
                          type="text"
                          value={stage3Form.generic_name}
                          onChange={(e) => setStage3Form({ ...stage3Form, generic_name: e.target.value })}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                          placeholder="e.g. Amoxicillin"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Brand
                        </label>
                        <input
                          type="text"
                          value={stage3Form.brand}
                          onChange={(e) => setStage3Form({ ...stage3Form, brand: e.target.value })}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                          placeholder="e.g. Epharm, Cadila"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                          Manufacturer
                        </label>
                        <input
                          type="text"
                          value={stage3Form.manufacturer}
                          onChange={(e) => setStage3Form({ ...stage3Form, manufacturer: e.target.value })}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                          placeholder="e.g. Cadila Pharma"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <label className="text-[11px] font-bold text-indigo-900 block mb-0.5">
                          Batch / Lot No. *
                        </label>
                        <input
                          type="text"
                          value={stage3Form.batch_number}
                          onChange={(e) => setStage3Form({ ...stage3Form, batch_number: e.target.value })}
                          className="w-full text-xs font-semibold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. B.N. 4920"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-emerald-900 block mb-0.5">
                          Expiry Date (yyyy-MM-dd) *
                        </label>
                        <input
                          type="date"
                          value={stage3Form.expiry_date}
                          onChange={(e) => setStage3Form({ ...stage3Form, expiry_date: e.target.value })}
                          className="w-full text-xs font-semibold px-2 py-1.5 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={stage3Saving}
                      onClick={handleStage3Save}
                      className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all mt-2"
                    >
                      {stage3Saving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving & Syncing to Desktop...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes & Sync to Desktop</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2.5 text-xs shadow-inner">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 text-[11px]">
                    <span className="font-semibold text-slate-300">Live Intake Summary</span>
                    <button
                      type="button"
                      onClick={() => setStage3EditMode(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-200"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Fields</span>
                    </button>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Product Name *</span>
                    <p className="text-sm font-bold text-white">
                      {productData.name || 'Awaiting product name...'}
                    </p>
                    {productData.generic_name && (
                      <p className="text-[11px] text-slate-300 mt-0.5">INN: {productData.generic_name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Type / Rx:</span>
                      <span className="font-semibold text-slate-200">
                        {productData.product_type || 'Medicine'} · {productData.requires_prescription ? 'Rx' : 'OTC'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Dosage Form:</span>
                      <span className="font-semibold text-slate-200">{productData.dosage_form || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Strength:</span>
                      <span className="font-semibold text-slate-200">{productData.strength || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Packaging Unit:</span>
                      <span className="font-semibold text-slate-200 capitalize">{productData.unit || 'Strip'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Brand / Mfr:</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {productData.brand || productData.manufacturer || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Category:</span>
                      <span className="font-semibold text-indigo-300 truncate block">
                        {categories.find((c) => c.id === (productData.category_id || sessionData?.productData?.category_id))?.name ||
                          productData.category ||
                          '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                      <span className="text-indigo-300 block text-[10px] font-bold">Batch / Lot No. *</span>
                      <span className="font-mono font-bold text-white">
                        {productData.batch_number || '—'}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
                      <span className="text-emerald-400 block text-[10px] font-bold">Expiry Date *</span>
                      <span className="font-mono font-bold text-white">
                        {normalizeExpiryDateString(productData.expiry_date) || productData.expiry_date || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Prompt and Scan Next */}
            <div className="space-y-2 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-center text-xs font-semibold">
                🖥️ Look at your desktop screen! Review the pre-filled fields, enter unit price & quantity, and save to inventory.
              </div>

              <button
                type="button"
                onClick={handleScanAnother}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Scan Another Medicine
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-1">
        <p className="text-[11px] text-slate-400">
          Session <span className="font-mono text-slate-300">{sessionId}</span> · TilexPharmacy
        </p>
      </footer>
    </div>
  );
};
export default MobileMedicineScanPage;
