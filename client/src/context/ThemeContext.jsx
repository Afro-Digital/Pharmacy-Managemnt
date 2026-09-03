import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState(null);
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');

  const applyColors = (primary, secondary) => {
    if (primary) {
      document.documentElement.style.setProperty('--color-primary', primary);
      // Darker shade for hover
      document.documentElement.style.setProperty('--color-primary-hover', primary + 'EE');
      document.documentElement.style.setProperty('--color-primary-light', primary + '1A');
    }
    if (secondary) {
      document.documentElement.style.setProperty('--color-secondary', secondary);
      document.documentElement.style.setProperty('--color-secondary-hover', secondary + 'EE');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data.success && res.data.data) {
        const s = res.data.data;
        setSettings(s);
        applyColors(s.primary_color, s.secondary_color);
      }
    } catch {
      // Fallback defaults
      applyColors('#2563EB', '#1E40AF');
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
    localStorage.setItem('tilex_lang', lang);
  };

  const pharmacyDisplayName = currentLang === 'am' && settings?.pharmacy_name_am
    ? settings.pharmacy_name_am
    : (settings?.pharmacy_name || 'TilexPharmacy');

  return (
    <ThemeContext.Provider value={{
      settings,
      currentLang,
      changeLanguage,
      pharmacyDisplayName,
      refreshSettings: fetchSettings,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
