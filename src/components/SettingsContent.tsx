'use client';

import {
  Palette,
  Type,
  Bell,
  Shield,
  Globe,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Added import
import { useAppSettings } from '@/providers/AppProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function SettingsContent() {
  // --- AUTHENTICATION LOGIC START ---
  const { setPasswordAfterGoogle, user, loading } = useAuth(); // Added 'loading'
  const router = useRouter(); // Added router

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null; // The redirect will happen in useEffect
  }
  // --- AUTHENTICATION LOGIC END ---

  const {
    fontSize,
    setFontSize,
    language,
    setLanguage,
    criticalAlerts,
    setCriticalAlerts,
    emailReports,
    setEmailReports,
    showPasswordModal,
    setShowPasswordModal,
  } = useAppSettings();

  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="text-gray-600">Loading...</div>;
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      // Case of a user who signed in with Google only
      const isGoogleOnly = user?.providerData.every(
        (provider) => provider.providerId === 'google.com'
      );

      if (isGoogleOnly) {
        await setPasswordAfterGoogle(newPassword);
        alert('Password linked successfully! You can now log in with this email and password.');
      } else {
        // Case of a user who already has an email/password account
        // Here we need to request the old password (re-auth) before changing
        alert(
          'Changing the password for email/password accounts is currently not supported.\n' +
          'If you want to add it, we will need a modal to type the old password.'
        );
        // If you want to finish it now, let me know and we will add reauthenticateWithCredential
      }

      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
    } catch (error: any) {
      console.error('Password change error:', error);
      alert('An error occurred while changing/linking the password: ' + (error.message || 'Try again'));
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Settings</h1>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-200">
          <div className="mb-6 flex items-center gap-3">
            <Palette className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">
              Appearance
            </h2>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-4">
                <Type size={20} />
                <div>
                  <p className="font-medium text-gray-900">Font Size</p>
                  <p className="text-sm text-gray-500">
                    Adjust text size across the app
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                {['small', 'medium', 'large'].map((size) => (
                  <button
                    key={size}
                    onClick={() =>
                      setFontSize(size as 'small' | 'medium' | 'large')
                    }
                    className={`rounded-lg px-5 py-2 capitalize transition ${
                      fontSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-200">
          <div className="mb-6 flex items-center gap-3">
            <Bell className="text-green-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">
              Notifications
            </h2>
          </div>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Critical Alerts</p>
                <p className="text-sm text-gray-500">
                  Notify when temperature or pressure is critical
                </p>
              </div>
              <input
                type="checkbox"
                checked={criticalAlerts}
                onChange={(e) => setCriticalAlerts(e.target.checked)}
                className="h-5 w-5 rounded text-blue-600"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Alerts</p>
                <p className="text-sm text-gray-500">
                  Send email alerts to a.mohamed0238@gmail.com on Warning or Critical conditions
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailReports}
                onChange={(e) => setEmailReports(e.target.checked)}
                className="h-5 w-5 rounded text-blue-600"
              />
            </label>
          </div>
        </div>

        {/* Security & Language */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-200">
            <div className="mb-4 flex items-center gap-3">
              <Shield className="text-purple-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">
                Security
              </h2>
            </div>
            {user && (
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full rounded-lg bg-gray-100 text-gray-900 px-4 py-3 text-left transition hover:bg-gray-200 font-medium"
              >
                {user.providerData.every(p => p.providerId === 'google.com')
                  ? 'Add Password (Google Sign-in)'
                  : 'Change Password'}
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-lg border border-gray-200">
            <div className="mb-4 flex items-center gap-3">
              <Globe className="text-indigo-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">
                Language
              </h2>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')}
              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-3"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="rounded-2xl bg-white p-8 shadow-2xl border border-gray-200 max-w-md w-full mx-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Change Password
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 rounded-lg border border-gray-300 text-gray-900 px-4 py-2 transition hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 font-medium"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}