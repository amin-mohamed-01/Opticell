'use client';

import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ProfilePage() {
  const { user, profile, updateProfileData, setPasswordAfterGoogle, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.displayName || profile?.name || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        // Sync state when profile loads/changes
        setName(user.displayName || profile?.name || '');
        setGender(profile?.gender || '');
        setPhone(profile?.phone || '');
      }
    }
  }, [user, profile, loading, router]);

  const handleSaveProfile = async () => {
    try {
      await updateProfileData({
        name: name.trim() || null,
        gender: (gender as 'male' | 'female') || null,
        phone: phone.trim(),
      });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage('Failed to update profile');
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword.trim()) {
      setMessage('Please enter a password');
      return;
    }

    try {
      await setPasswordAfterGoogle(newPassword.trim());
      setNewPassword('');
      setMessage('Password set successfully! You can now use email + password to sign in.');
    } catch (err) {
      setMessage('Failed to set password');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) return null; // redirect already handled

  const isGoogleOnly = user.providerData.some((p) => p.providerId === 'google.com');

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 md:p-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">My Profile</h1>

          {/* User Info Header */}
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 pb-8 border-b">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-semibold">{user.displayName || 'User'}</h2>
              <p className="text-gray-600">{user.email}</p>
              <p className="text-sm text-gray-500 mt-1">
                Signed in with {user.providerData.map((p) => p.providerId.split('.')[0]).join(', ')}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+20 123 456 7890"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Save Profile
            </button>

            {/* Password section – only for Google users who don't have password yet */}
            {isGoogleOnly && (
              <div className="pt-8 mt-8 border-t">
                <h3 className="text-lg font-semibold mb-4">Add Email/Password Sign-in</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You signed in with Google. Add a password to sign in with email & password later.
                </p>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                />

                <button
                  onClick={handleSetPassword}
                  className="w-full bg-green-600 text-white py-3.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Set Password
                </button>
              </div>
            )}
          </div>

          {message && (
            <div
              className={`mt-6 p-4 rounded-lg text-center ${
                message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}