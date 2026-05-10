'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AppContextType {
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
  criticalAlerts: boolean;
  setCriticalAlerts: (value: boolean) => void;
  emailReports: boolean;
  setEmailReports: (value: boolean) => void;
  showPasswordModal: boolean;
  setShowPasswordModal: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>('medium');
  const [language, setLanguageState] = useState<'en' | 'ar'>('en');
  const [criticalAlerts, setCriticalAlertsState] = useState(true);
  const [emailReports, setEmailReportsState] = useState(false);
  const [showPasswordModal, setShowPasswordModalState] = useState(false);
  
  // We use a ref to track if we are on the client side to avoid hydration mismatches,
  // but we do NOT stop rendering the Provider.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load settings from localStorage only on client
    const saved = localStorage.getItem('fontSize') as 'small' | 'medium' | 'large' | null;
    const savedLang = localStorage.getItem('language') as 'en' | 'ar' | null;
    const savedAlerts = localStorage.getItem('criticalAlerts');
    const savedEmails = localStorage.getItem('emailReports');

    if (saved) setFontSizeState(saved);
    if (savedLang) setLanguageState(savedLang);
    if (savedAlerts) setCriticalAlertsState(JSON.parse(savedAlerts));
    if (savedEmails) setEmailReportsState(JSON.parse(savedEmails));
  }, []);

  // Apply font size changes
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('fontSize', fontSize);
    applyFontSize(fontSize);
  }, [fontSize, mounted]);

  // Apply language changes
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('criticalAlerts', JSON.stringify(criticalAlerts));
    }
  }, [criticalAlerts, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('emailReports', JSON.stringify(emailReports));
    }
  }, [emailReports, mounted]);

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    const root = document.documentElement;
    if (size === 'small') root.style.fontSize = '14px';
    else if (size === 'large') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';
  };

  // IMPORTANT: We ALWAYS render the Provider.
  // We do NOT return <>{children}</> early, because children (ReportsProvider) need this context to exist immediately.
  return (
    <AppContext.Provider
      value={{
        fontSize,
        setFontSize: setFontSizeState,
        language,
        setLanguage: setLanguageState,
        criticalAlerts,
        setCriticalAlerts: setCriticalAlertsState,
        emailReports,
        setEmailReports: setEmailReportsState,
        showPasswordModal,
        setShowPasswordModal: setShowPasswordModalState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppSettings must be used within AppProvider');
  return context;
}