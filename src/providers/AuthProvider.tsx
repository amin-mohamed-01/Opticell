'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  linkWithCredential,
  EmailAuthProvider,
  updateProfile,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';

type UserProfile = {
  name?: string | null;
  gender?: 'male' | 'female' | null;
  phone?: string;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setPasswordAfterGoogle: (password: string) => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ALLOWED_EMAILS = [
  'shrifamazon@gmail.com',
  'a.mohamed0238@gmail.com',
  'mohamed.aboelgoud.mh@gmail.com',
  'oa741536@gmail.com',
  'rehamothman28874@gmail.com',
  'hadeerkamal264@gmail.com',
  'yousefsamehkhallaf@gmail.com',
  'elgarhey1802@gmail.com',
].map(email => email.toLowerCase());

const checkWhitelist = async (firebaseUser: User): Promise<boolean> => {
  const email = firebaseUser.email?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    console.error(`Access Forbidden: ${email || 'unknown'} is not authorized.`);
    try {
      // Sign out and delete the unauthorized account immediately to keep Auth clean
      await signOut(auth);
      await firebaseUser.delete();
    } catch (e) {
      console.warn("Unauthorized user cleanup failed:", e);
    }
    window.location.replace('/access-denied');
    return false;
  }
  return true;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Double check whitelist on state change for active sessions
        const isAllowed = ALLOWED_EMAILS.includes(firebaseUser.email?.toLowerCase() || '');
        if (!isAllowed) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          window.location.replace('/access-denied');
          return;
        }

        setUser(firebaseUser);
        setLoading(true);

        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          let userProfile: UserProfile;

          if (docSnap.exists()) {
            userProfile = docSnap.data() as UserProfile;

            // Ensure the profile picks up the auth display name as a fallback.
            if (!userProfile.name && firebaseUser.displayName) {
              userProfile.name = firebaseUser.displayName;
            }
          } else {
            userProfile = {
              name: firebaseUser.displayName || '',
              gender: null,
              phone: '',
            };
            await setDoc(docRef, userProfile);
          }

          setProfile(userProfile);

          // --- FIX STARTS HERE ---
          // Handle optional phone property safely using (value || fallback)
          const profileIncomplete =
            !userProfile.gender ||
            (userProfile.phone || '').trim() === '';
          // --- FIX ENDS HERE ---

          if (profileIncomplete) {
            if (window.location.pathname !== '/profile') {
              window.location.replace('/profile');
            }
          }
        } catch (firestoreError: any) {
          // Firestore permission error — user is still authenticated,
          // just fall back to auth display name so the app doesn't crash.
          console.warn('[AuthProvider] Firestore access failed (permissions?):', firestoreError?.message);
          setProfile({ name: firebaseUser.displayName || '' });
        }
      } else {
        setUser(null);
        setProfile(null);

        // --- UPDATED ROUTE CHECK STARTS HERE ---
        const publicPaths = ['/login', '/signup', '/forgot-password']; // ← list all routes that allow unauthenticated access

        if (!publicPaths.includes(window.location.pathname)) {
          window.location.replace('/login');
        }
        // --- UPDATED ROUTE CHECK ENDS HERE ---
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await checkWhitelist(result.user);
      }
    } catch (error: any) {
      console.error("Google sign-in failed:", error);
      alert("Google sign-in failed: " + error.message);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) {
        await checkWhitelist(result.user);
      }
    } catch (error: any) {
      console.error("Email sign-in failed:", error);
      alert("Sign-in failed: " + (error.message || "Invalid credentials"));
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    // PRE-CHECK Whitelist for signup
    if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
      alert(`Forbidden: The email ${email} is not on the authorized list. You cannot create an account.`);
      return;
    }

    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const cred: UserCredential = await createUserWithEmailAndPassword(auth, email, password);

      if (name.trim() && cred.user) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (error: any) {
      console.error("Sign-up failed:", error);
      alert("Sign-up failed: " + (error.message || "Please try again"));
    }
  };

  const setPasswordAfterGoogle = async (password: string) => {
    if (!user || !user.email) {
      alert("No user is currently signed in!");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await linkWithCredential(user, credential);
      alert("Password linked successfully! You can now sign in with email & password.");
    } catch (error: any) {
      console.error("Link credential failed:", error);
      alert("Failed to link password: " + error.message);
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!user) return;

    try {
      // Update the auth user display name if it has been changed.
      if (data.name !== undefined && data.name !== user.displayName) {
        await updateProfile(user, { displayName: data.name });
      }

      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, data, { merge: true });
      setProfile((prev) => (prev ? { ...prev, ...data } : (data as UserProfile)));
    } catch (error: any) {
      console.error("Profile update failed:", error);
      alert("Failed to save profile data");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        setPasswordAfterGoogle,
        updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};