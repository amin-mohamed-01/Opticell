'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const DashboardContent = dynamic(
  () => import('@/components/DashboardContent'), // Now resolves correctly
  {
    ssr: false,
    loading: () => <div className="text-gray-600 dark:text-gray-400">Loading...</div>,
  }
);

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="text-gray-600 dark:text-gray-400">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}