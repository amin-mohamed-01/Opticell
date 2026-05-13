'use client';

/*
 * ══════════════════════════════════════════════════════════════════════
 * ML FACE PAGE — Real-Time Predictive Maintenance Avatar
 * ══════════════════════════════════════════════════════════════════════
 *
 * ML Pipeline Flow:
 *   Next.js (this page)
 *     → fetch 15 latest sensor readings from MongoDB via /api/readings
 *     → POST raw sensor history to FastAPI /predict
 *     → FastAPI performs ALL feature engineering:
 *         - rolling mean (window=5)
 *         - rolling std  (window=5)
 *         - diff1
 *         - fixes "temprature" → "temperature"
 *         - drops "pressure" column
 *     → FastAPI applies scaler transform
 *     → FastAPI runs classification model → predicted_label
 *     → FastAPI runs regression model → predicted_rul
 *     → Response: { predicted_label, predicted_rul }
 *     → Frontend updates avatar face state
 *
 * CRITICAL: Frontend does NOT compute any ML features.
 *           All preprocessing is centralized in FastAPI.
 * ══════════════════════════════════════════════════════════════════════
 */

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { BrainCircuit, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { FaceState } from '@/components/MLFaceAvatar';

const MLFaceAvatar = dynamic(() => import('@/components/MLFaceAvatar'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const POLL_INTERVAL = 10_000; // 10 seconds
const HISTORY_WINDOW = 15;    // send 15 readings for stable rolling stats

// Label → avatar state mapping
const LABEL_TO_FACE: Record<string, FaceState> = {
  normal: 'normal',   // → 😊 happy
  warning: 'warning',  // → 😐 neutral
  critical: 'critical', // → 😢 sad
};

// Label → UI metadata
const LABEL_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  normal: { emoji: '😊', label: 'Normal', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  warning: { emoji: '😐', label: 'Warning', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  critical: { emoji: '😢', label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function MLFacePage() {
  const [faceState, setFaceState] = useState<FaceState>('normal');
  const [predictedLabel, setPredictedLabel] = useState<string | null>(null);
  const [predictedRul, setPredictedRul] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [pollActive, setPollActive] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Core prediction function ──────────────────────────────────────
  const runPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch latest readings from MongoDB via Next.js API
      const readingsRes = await fetch(`/api/readings?t=${Date.now()}`);
      if (!readingsRes.ok) throw new Error(`Failed to fetch readings: HTTP ${readingsRes.status}`);

      const allReadings: Array<Record<string, unknown>> = await readingsRes.json();
      if (!Array.isArray(allReadings) || allReadings.length < HISTORY_WINDOW) {
        throw new Error(`Insufficient sensor data. Need ${HISTORY_WINDOW}, got ${allReadings?.length ?? 0}`);
      }

      // Step 2: Take the latest N readings, reverse to chronological (oldest → newest)
      //         /api/readings returns newest-first, but rolling stats need chronological order
      const window = allReadings.slice(0, HISTORY_WINDOW).reverse();

      // Step 3: Flatten sensor data for FastAPI
      //         MongoDB format: { data: { temprature, humidity, pressure, gas_quality } }
      //         FastAPI expects: [{ temprature, humidity, pressure, gas_quality }, ...]
      const history = window.map((r: Record<string, unknown>) => {
        const data = r.data as Record<string, unknown> | undefined;
        if (!data) return {};
        return {
          temprature: data.temprature ?? data.temperature ?? 0,
          humidity: data.humidity ?? 0,
          pressure: data.pressure ?? 102,
          gas_quality: data.gas_quality ?? data.gasQuality ?? 0,
        };
      });

      // Step 4: POST to FastAPI /predict
      const predRes = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }),
      });

      if (!predRes.ok) {
        const errBody = await predRes.json().catch(() => ({}));
        throw new Error(errBody.detail || `Prediction failed: HTTP ${predRes.status}`);
      }

      const { predicted_label, predicted_rul } = await predRes.json();

      // Step 5: Update UI state
      setPredictedLabel(predicted_label);
      setPredictedRul(predicted_rul);
      setFaceState(LABEL_TO_FACE[predicted_label] || 'normal');
      setLastUpdate(new Date().toLocaleTimeString());

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Prediction failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-prediction on mount + polling every 10s ──────────────────
  useEffect(() => {
    // Run immediately on mount
    runPrediction();

    // Set up polling
    if (pollActive) {
      intervalRef.current = setInterval(runPrediction, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runPrediction, pollActive]);

  const meta = LABEL_META[predictedLabel ?? 'normal'];

  return (
    <div
      style={{
        margin: '-2rem',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Full-viewport avatar canvas ── */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MLFaceAvatar state={faceState} />
      </div>

      {/* ── Status HUD (top-right) ── */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 10,
          minWidth: '260px',
        }}
      >
        {/* Live status chip */}
        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            border: `2px solid ${meta.color}`,
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Activity size={16} style={{ color: meta.color }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ML Prediction
            </span>
            {loading && (
              <RefreshCw size={14} style={{ color: '#9CA3AF', animation: 'spin 1s linear infinite' }} />
            )}
          </div>

          {predictedLabel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.6rem' }}>{meta.emoji}</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
              </div>
              {predictedRul !== null && (
                <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '4px' }}>
                  ⏱ RUL: <strong>{predictedRul.toFixed(1)}</strong> cycles remaining
                </div>
              )}
              {lastUpdate && (
                <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                  Last update: {lastUpdate}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>
              {loading ? 'Running prediction...' : 'Awaiting first prediction...'}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              marginTop: '8px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '0.75rem',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <XCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Controls panel (bottom-right) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          zIndex: 10,
          maxWidth: '320px',
        }}
      >
        {/* Refresh button */}
        <button
          onClick={() => runPrediction()}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            border: '1.5px solid #E5E7EB',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            color: loading ? '#9CA3AF' : '#374151',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
            marginBottom: '10px',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {loading ? 'Predicting...' : 'Refresh Prediction'}
        </button>

        {/* Poll toggle */}
        <button
          onClick={() => setPollActive((p) => !p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            background: pollActive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)',
            color: pollActive ? '#16A34A' : '#DC2626',
            fontSize: '0.72rem',
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'center',
            marginBottom: '10px',
          }}
        >
          {pollActive ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
          {pollActive ? 'Auto-poll ON (10s)' : 'Auto-poll OFF'}
        </button>

        {/* Info card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(8px)',
            borderRadius: '14px',
            border: '1px solid rgba(124,58,237,0.2)',
            padding: '14px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <BrainCircuit size={15} style={{ color: '#7C3AED' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#581C87' }}>ML Pipeline Active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { label: 'Normal →', desc: 'System healthy 😊' },
              { label: 'Warning →', desc: 'Anomaly detected 😐' },
              { label: 'Critical →', desc: 'Failure imminent 😢' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', gap: '6px', fontSize: '0.7rem' }}>
                <span style={{ fontWeight: 600, color: '#7C3AED' }}>{item.label}</span>
                <span style={{ color: '#A78BFA' }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spin animation keyframes */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
