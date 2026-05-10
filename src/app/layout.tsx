// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Providers
import { AuthProvider } from '@/providers/AuthProvider';
import { AppProvider } from '@/providers/AppProvider';
import { ReportsProvider } from '@/providers/ReportsProvider';
import { RootLayoutClient } from '@/components/RootLayoutClient';

const inter = Inter({ subsets: ['latin',] }); // ← added 'arabic' subset

export const metadata: Metadata = {
  title: 'OptiCell',
  description: 'Bioreactor Monitoring Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="light">
      <body className={inter.className}>
        <AuthProvider>
          <AppProvider>
            <ReportsProvider>
              {/* 
                RootLayoutClient can now safely handle:
                - Navbar / Sidebar
                - Conditional rendering based on user / loading
                - Optional Suspense boundaries
              */}
              <RootLayoutClient>{children}</RootLayoutClient>
            </ReportsProvider>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}