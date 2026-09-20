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
  Check,
  Clock,
  Loader2,
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

  // Stage 1 State (Barcode)
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

          // If stage 2 is complete, auto-advance to stage 3 if user is on stage 2
          if (s.stage2?.status === 'COMPLETED' && s.stage1?.status === 'COMPLETED') {
            setStage2Submitted(true);
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
  }, [sessionId]);

  // Handle Stage 1 file selection (Barcode)
  const handleStage1FileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage1File(file);
    setStage1Preview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  // Submit Stage 1 Barcode asynchronously
  const handleStage1Submit = async () => {
    if (!stage1File && !stage1ManualBarcode.trim()) {
      setErrorMessage('Please snap a photo of the barcode or type the barcode numbers.');
      return;
    }

    setStage1Uploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      if (stage1File) {
        formData.append('image', stage1File);
      }
      if (stage1ManualBarcode.trim()) {
        formData.append('barcode', stage1ManualBarcode.trim());
      }

      await axios.post(`${API_BASE}/vision/scan-session/${sessionId}/stage1-barcode`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStage1Submitted(true);
      showToast('⚡ Google Lens analyzing packaging! Now snap expiry & batch.');
      // ASYNCHRONOUS NON-BLOCKING: Transition to Stage 2 immediately!
      setCurrentStage(2);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to submit barcode. Please try again.';
      setErrorMessage(msg);
    } finally {
      setStage1Uploading(false);
    }
  };

  // Handle Stage 2 file selection (Expiry & Batch)
  const handleStage2FileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage2File(file);
    setStage2Preview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  // Submit Stage 2 Expiry/Batch asynchronously
  const handleStage2Submit = async () => {
    if (!stage2File) {
      setErrorMessage('Please take a clear photo of the expiry date and batch number stamp.');
      return;
    }

    setStage2Uploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', stage2File);

      // Backend returns 202 Accepted immediately
      await axios.post(`${API_BASE}/vision/scan-session/${sessionId}/stage2-expiry`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStage2Submitted(true);
      showToast('🚀 Expiry & Batch photo received! Server is processing.');
      // Transition to Stage 3 Live Sync
      setCurrentStage(3);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to upload photo. Please retry.';
      setErrorMessage(msg);
    } finally {
      setStage2Uploading(false);
    }
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
            </div>

            {/* Bottom Button for Stage 1 */}
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
                    <span>Analyze Product Image & Continue</span>
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

        {/* ─── STAGE 3: LIVE DESKTOP SYNC & COMPLETION ─── */}
        {currentStage === 3 && (
          <div className="h-full flex flex-col justify-between py-1 space-y-4">
            <div className="space-y-3">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner mb-1">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Transferred to Desktop!
                </h2>
                <p className="text-xs text-slate-500">
                  Data from your photos is streaming straight to your desktop product form.
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
                      ? 'Queued behind Stage 1'
                      : 'Pending'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    Stage 3: Manual Completion
                  </span>
                  <span className="font-semibold text-[11px] text-violet-700 bg-violet-100 px-2 py-0.5 rounded">
                    Open on Desktop
                  </span>
                </div>
              </div>

              {/* Detected fields summary card */}
              <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 text-[11px]">
                  <span>Live Product Preview</span>
                  <span className="font-mono text-[10px] text-violet-300">Auto-filled</span>
                </div>

                <div>
                  <p className="text-sm font-bold text-white">
                    {productData.name || 'Awaiting product name...'}
                  </p>
                  {productData.generic_name && (
                    <p className="text-[11px] text-slate-300">{productData.generic_name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Strength:</span>
                    <span className="font-semibold text-slate-200">{productData.strength || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Dosage Form:</span>
                    <span className="font-semibold text-slate-200">{productData.dosage_form || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Batch Number:</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {productData.batch_number || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Expiry Date:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {normalizeExpiryDateString(productData.expiry_date) || productData.expiry_date || '—'}
                    </span>
                  </div>
                </div>
              </div>
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
