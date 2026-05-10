'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import type { FaceState } from '@/components/MLFaceAvatar';

const MLFaceAvatar = dynamic(() => import('@/components/MLFaceAvatar'), { ssr: false });

export default function MLFacePage() {
  const [faceState] = useState<FaceState>('normal');

  return (
    /* Cancel the p-8 (2rem) wrapper padding so the canvas bleeds edge-to-edge
       inside the <main> content area, then fill full viewport height */
    <div
      style={{
        margin: '-2rem',          /* cancel parent p-8 */
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Full-main canvas ── */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MLFaceAvatar state={faceState} />
      </div>

      {/* ── Future Integration card (floating bottom-right) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          zIndex: 10,
          maxWidth: '320px',
        }}
        className="rounded-2xl border border-purple-100 bg-purple-50 p-6 shadow-xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-purple-600" />
          <h3 className="font-bold text-purple-900">Future Integration</h3>
        </div>
        <p className="text-sm leading-relaxed text-purple-700">
          This avatar will be automatically driven by an <strong>ML model</strong> connected
          to real-time sensor data. The face expression will reflect the system&apos;s
          health status — no manual selection needed.
        </p>
        <div className="mt-4 space-y-2">
          {[
            { label: 'Normal →',   desc: 'All sensors healthy' },
            { label: 'Happy →',    desc: 'Performance optimal' },
            { label: 'Confused →', desc: 'Anomaly detected' },
            { label: 'Sad →',      desc: 'Critical failure' },
          ].map((item) => (
            <div key={item.label} className="flex gap-2 text-xs text-purple-600">
              <span className="font-semibold">{item.label}</span>
              <span className="text-purple-400">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
