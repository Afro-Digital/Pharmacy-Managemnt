import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Camera, Upload, CheckCircle2, AlertCircle, RefreshCw, Pill, ArrowLeft } from 'lucide-react';
import { API_BASE } from '../../services/api';

export const MobileRxUploadPage = () => {
  const { sessionId } = useParams();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please capture or select a photo of your prescription first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/prescriptions/upload-session/${sessionId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setUploadSuccess(true);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error?.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="h-screen w-screen overflow-y-auto bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col items-center justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-md text-center py-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-lg mb-2">
          <Pill className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">TilexPharmacy</h1>
        <p className="text-xs text-blue-200 mt-0.5">Mobile Prescription Camera Uploader</p>
      </header>

      {/* Main Content Card */}
      <main className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 shadow-2xl flex-1 flex flex-col justify-between my-2">
        {uploadSuccess ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Upload Complete!</h2>
              <p className="text-sm text-slate-500 mt-2">
                Your prescription photo has been received by the pharmacist.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                You may now close this browser tab.
              </p>
            </div>
            <button
              onClick={() => {
                setUploadSuccess(false);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
              className="text-xs text-blue-600 hover:underline font-semibold pt-4"
            >
              Upload another page
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Capture Prescription</h2>
              <p className="text-xs text-slate-500">
                Snap a clear photo of the paper prescription slip using your camera.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Hidden native camera capture file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Photo Capture / Preview Box */}
            <div className="w-full aspect-[4/3] bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden flex flex-col items-center justify-center relative group">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Prescription preview"
                  className="w-full h-full object-contain bg-slate-900"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-500 hover:text-blue-600 transition-colors focus:outline-none"
                >
                  <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-xs">
                    <Camera className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Tap to Open Camera</span>
                  <span className="text-xs text-slate-400 mt-1">or select prescription from photos</span>
                </button>
              )}
            </div>

            {previewUrl && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Send to Pharmacy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Instructions */}
      <footer className="w-full max-w-md text-center py-2 text-[11px] text-blue-200/70">
        Session Token: <span className="font-mono text-white">{sessionId}</span>
        <p className="mt-0.5">Secure transmission directly to pharmacist counter</p>
      </footer>
    </div>
  );
};
