'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { FaceState } from './MLFaceAvatar';

const MLFaceAvatar = dynamic(() => import('./MLFaceAvatar'), { ssr: false });

interface MLFaceModalProps { onClose: () => void; }

const STATES: { value: FaceState; label: string; emoji: string; desc: string; color: string }[] = [
  { value: 'normal',   label: 'Normal',   emoji: '😊', desc: 'System operating normally', color: '#22C55E' },
  { value: 'warning',  label: 'Warning',  emoji: '😐', desc: 'Warning detected',          color: '#F59E0B' },
  { value: 'critical', label: 'Critical', emoji: '😢', desc: 'Critical issue found',       color: '#EF4444' },
];

export default function MLFaceModal({ onClose }: MLFaceModalProps) {
  const [faceState, setFaceState] = useState<FaceState>('normal');
  const active = STATES.find((s) => s.value === faceState)!;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="mlf-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mlf-modal">
        {/* Header */}
        <div className="mlf-header">
          <div>
            <div className="mlf-title-row">
              <h2 className="mlf-title">ML Face</h2>
              <span className="mlf-badge">ML Active</span>
            </div>
            <p className="mlf-sub">2D Reactive Avatar · ML-Driven</p>
          </div>
          <button className="mlf-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Canvas */}
        <div className="mlf-canvas">
          <MLFaceAvatar state={faceState} />
          <div className="mlf-chip" style={{ color: active.color, borderColor: active.color }}>
            {active.emoji} {active.label}
          </div>
        </div>

        {/* Status desc */}
        <p className="mlf-desc" style={{ color: active.color }}>{active.desc}</p>

        {/* Buttons */}
        <div className="mlf-btns">
          {STATES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFaceState(s.value)}
              className={`mlf-btn ${faceState === s.value ? 'mlf-btn-active' : ''}`}
              style={faceState === s.value ? { borderColor: s.color, color: s.color, background: `${s.color}12` } : {}}
            >
              <span className="mlf-btn-emoji">{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Note */}
        <div className="mlf-note">
          🤖 <strong>Active:</strong> The ML model drives this avatar&apos;s state based on real-time sensor analysis.
        </div>
      </div>

      <style jsx>{`
        .mlf-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: mlf-in 0.18s ease;
        }
        @keyframes mlf-in { from { opacity:0 } to { opacity:1 } }

        .mlf-modal {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          width: 100%; max-width: 420px;
          padding: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          animation: mlf-up 0.22s ease;
        }
        @keyframes mlf-up { from { transform:translateY(16px); opacity:0 } to { transform:translateY(0); opacity:1 } }

        .mlf-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
        .mlf-title-row { display:flex; align-items:center; gap:10px; }
        .mlf-title { font-size:1.15rem; font-weight:700; color:#111827; }
        .mlf-badge {
          font-size:0.62rem; font-weight:600; padding:2px 8px; border-radius:999px;
          background:#DCFCE7; color:#16A34A; border:1px solid #86EFAC;
          text-transform:uppercase; letter-spacing:0.06em;
        }
        .mlf-sub { font-size:0.76rem; color:#9CA3AF; margin-top:3px; }
        .mlf-close {
          background:#F3F4F6; border:none; color:#6B7280;
          width:30px; height:30px; border-radius:8px; cursor:pointer;
          font-size:0.85rem; display:flex; align-items:center; justify-content:center;
          transition:background 0.15s;
        }
        .mlf-close:hover { background:#E5E7EB; color:#374151; }

        .mlf-canvas {
          position:relative; width:100%; height:260px;
          border-radius:12px; overflow:hidden;
          border:1px solid #E5E7EB;
          margin-bottom:12px;
        }
        .mlf-chip {
          position:absolute; top:10px; right:10px;
          font-size:0.78rem; font-weight:600;
          padding:3px 12px; border-radius:999px;
          background:rgba(255,255,255,0.88);
          border:1.5px solid; backdrop-filter:blur(4px);
          transition:color 0.4s, border-color 0.4s;
        }

        .mlf-desc {
          text-align:center; font-size:0.82rem; font-weight:500;
          margin-bottom:14px; min-height:18px; transition:color 0.4s;
        }

        .mlf-btns { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
        .mlf-btn {
          display:flex; flex-direction:column; align-items:center; gap:4px;
          padding:10px 6px; border-radius:10px;
          border:1.5px solid #E5E7EB;
          background:#F9FAFB; color:#6B7280;
          font-size:0.73rem; font-weight:500; cursor:pointer;
          transition:all 0.18s;
        }
        .mlf-btn:hover:not(.mlf-btn-active) { background:#F3F4F6; color:#374151; }
        .mlf-btn-emoji { font-size:1.25rem; }

        .mlf-note {
          font-size:0.74rem; color:#9CA3AF;
          background:#F9FAFB; border:1px solid #E5E7EB;
          border-radius:10px; padding:10px 14px; line-height:1.5;
        }
        .mlf-note strong { color:#16A34A; }
      `}</style>
    </div>
  );
}
