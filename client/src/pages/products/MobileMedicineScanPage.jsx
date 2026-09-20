import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { API_BASE } from '../../services/api';

export const MobileMedicineScanPage = () => {
  const { sessionId } = useParams();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('Please snap or select a photo of the medicine first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/vision/scan-session/${sessionId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setAnalysisResult(res.data.data);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        'Could not analyze packaging. Please try a clearer, well-lit photo.';
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setErrorMessage(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-md mx-auto text-center pt-2 pb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-xl shadow-violet-900/40 mb-2">
          <Pill className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
          TilexPharmacy
          <span className="text-xs bg-violet-600 text-violet-100 font-bold px-2 py-0.5 rounded-full">
            AI Vision
          </span>
        </h1>
        <p className="text-xs text-slate-300 mt-0.5">Mobile Camera Medicine Scanner</p>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md mx-auto bg-white text-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl flex-1 flex flex-col justify-between my-2">
        {analysisResult ? (
          /* SUCCESS STATE */
          <div className="h-full flex flex-col justify-between py-2 space-y-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Analyzed & Transferred!</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Product details have been sent to your desktop screen in real time.
                </p>
              </div>
            </div>

            {/* Extracted Product Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-left text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Detected Product
                </span>
                <span className="bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded">
                  {analysisResult.extracted?.product_type || 'MEDICINE'}
                </span>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900">
                  {analysisResult.extracted?.name || 'Unknown Product'}
                </p>
                {analysisResult.extracted?.name_am && (
                  <p className="text-xs text-slate-600 font-medium">{analysisResult.extracted.name_am}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Strength:</span>
                  <span className="font-semibold text-slate-700">
                    {analysisResult.extracted?.strength || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Dosage Form:</span>
                  <span className="font-semibold text-slate-700">
                    {analysisResult.extracted?.dosage_form || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Batch Number:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {analysisResult.extracted?.batch_number || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Expiry Date:</span>
                  <span className="font-mono font-semibold text-violet-700">
                    {analysisResult.extracted?.expiry_date || '—'}
                  </span>
                </div>
              </div>

              {analysisResult.existingProduct && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>Matches existing item: <strong>{analysisResult.existingProduct.name}</strong></span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-center text-xs font-semibold">
                🖥️ You can now review & save the product on your desktop!
              </div>
              <button
                type="button"
                onClick={handleRetake}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Scan Another Medicine
              </button>
            </div>
          </div>
        ) : (
          /* CAPTURE / PREVIEW STATE */
          <div className="h-full flex flex-col justify-between space-y-4">
            <div>
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold text-slate-900">Scan Medicine Packaging</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Snap a photo of the medicine box, blister pack, or bottle. Our AI will automatically
                  extract name, strength, batch, and expiry.
                </p>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {previewUrl ? (
                /* PREVIEW BOX */
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-violet-200 bg-slate-900 aspect-[4/3] flex items-center justify-center shadow-md">
                    <img
                      src={previewUrl}
                      alt="Captured medicine"
                      className="w-full h-full object-contain"
                    />
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center">
                        <div className="relative mb-3">
                          <div className="w-12 h-12 rounded-full border-4 border-violet-400/30 border-t-violet-400 animate-spin" />
                          <Sparkles className="w-5 h-5 text-violet-300 absolute inset-0 m-auto animate-pulse" />
                        </div>
                        <p className="text-sm font-bold">Analyzing with AI...</p>
                        <p className="text-xs text-slate-300 mt-1 max-w-[220px]">
                          Extracting medicine identity, strength, batch, and expiry date
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake Photo
                    </button>
                    <button
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Pick from Gallery
                    </button>
                  </div>
                </div>
              ) : (
                /* INITIAL CAMERA TRIGGER BOX */
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full py-8 px-4 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/50 hover:bg-violet-50 text-violet-700 flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    <div className="w-16 h-16 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-400/40">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <span className="text-base font-bold block text-slate-900">
                        📸 Tap to Snap Photo
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        Opens phone camera directly
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    Choose photo from phone gallery / files
                  </button>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      💡 <strong>Tips for best result:</strong> Hold camera steady, ensure good lighting,
                      and keep the brand name, strength (e.g. 500mg), and expiry date visible.
                    </p>
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

            {/* Bottom Action Button */}
            {previewUrl && (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleUploadAndAnalyze}
                  className="w-full py-3.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAnalyzing ? 'Analyzing Packaging...' : 'Send to Desktop & Analyze'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-2">
        <p className="text-[11px] text-slate-400">
          Connected to TilexPharmacy session <span className="font-mono text-slate-300">{sessionId}</span>
        </p>
      </footer>
    </div>
  );
};
