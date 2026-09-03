import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Pill, ShieldCheck, UserCheck } from 'lucide-react';

export const LoginPage = () => {
  const { login, initialSetup, isSetup } = useAuth();
  const { pharmacyDisplayName, currentLang, changeLanguage } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Setup form (if isSetup is false)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!isSetup) {
        await initialSetup({
          full_name: fullName,
          username,
          email,
          password,
          phone,
        });
      } else {
        await login(username, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Top language toggle */}
      <div className="absolute top-6 right-6 flex bg-slate-800/80 backdrop-blur-xs border border-slate-700/60 p-1 rounded-xl">
        <button
          onClick={() => changeLanguage('en')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            currentLang === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          English
        </button>
        <button
          onClick={() => changeLanguage('am')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            currentLang === 'am' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          አማርኛ
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-4">
            <Pill className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {pharmacyDisplayName}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {!isSetup ? 'Initial System Setup • Create Admin' : 'Pharmacy & Cosmetics Management System'}
          </p>
        </div>

        {error && (
          <Alert variant="error" className="mb-5" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isSetup && (
            <>
              <Input
                label="Full Name"
                placeholder="e.g. Dr. Super Admin"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="admin@tilexpharmacy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Phone"
                placeholder="+2519..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </>
          )}

          <Input
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            isLoading={loading}
            className="w-full py-3 mt-2 text-base font-semibold"
          >
            {!isSetup ? 'Complete Setup & Sign In' : 'Sign In'}
          </Button>
        </form>

        {isSetup && (
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-2 font-medium">Default Credentials for Demo:</p>
            <div className="flex flex-wrap justify-center gap-2 text-[11px] text-slate-600">
              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">admin / admin123</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">pharmacist1 / pharma123</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">cashier1 / cashier123</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
