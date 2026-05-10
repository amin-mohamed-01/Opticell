'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const HelpContent = dynamic(
  () => import('@/components/HelpContent'),
  {
    ssr: false,
    loading: () => (
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    ),
  }
);

export default function Help() {
  return (
    <Suspense
      fallback={<div className="text-gray-600 dark:text-gray-400">Loading...</div>}
    >
      <HelpContent />
    </Suspense>
  );
}
