'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const SettingsContent = dynamic(
  () => import('@/components/SettingsContent'),
  {
    ssr: false,
    loading: () => (
      <div className="text-gray-600 dark:text-gray-400">Loading...</div>
    ),
  }
);

export default function Settings() {
  return (
    <Suspense
      fallback={<div className="text-gray-600 dark:text-gray-400">Loading...</div>}
    >
      <SettingsContent />
    </Suspense>
  );
}