'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { AppProvider } from '@/providers/AppProvider';
import { DashboardProvider } from '@/providers/DashboardProvider';
import Sidebar from '@/components/Sidebar';
import DeviceRestriction from '@/components/DeviceRestriction';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const publicPaths = ['/login', '/signup', '/forgot-password', '/help', '/help/chat', '/help/faq', '/help/manual'];
  const isPublicRoute = publicPaths.includes(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace('/login');
    }
  }, [user, loading, router, isPublicRoute]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // When user is not authenticated, allow public routes to render.
  if (!user && isPublicRoute) {
    return (
      <>
        <DeviceRestriction />
        {children}
      </>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-white">
      <DeviceRestriction />
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppProvider>
        <DashboardProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
        </DashboardProvider>
      </AppProvider>
    </AuthProvider>
  );
}