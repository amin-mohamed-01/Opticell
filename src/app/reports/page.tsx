'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ReportsContent = dynamic(
  () => import('@/components/ReportsContent'),
  {
    ssr: false,
    loading: () => (
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    ),
  }
);

export default function Reports() {
  return (
    <Suspense
      fallback={<div className="text-gray-600 dark:text-gray-400">Loading...</div>}
    >
      <ReportsContent />
    </Suspense>
  );
}