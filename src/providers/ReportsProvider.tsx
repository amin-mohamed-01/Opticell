// src/providers/ReportsProvider.tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAppSettings } from '@/providers/AppProvider';

export type Report = {
  id: string;
  timestamp: string;
  status: 'Normal' | 'Warning' | 'Critical';
  details: string;
  temp: number;
  humidity: number;
  pressure: number;
  gasQuality: number;
  equipment: string;
};

interface ReportsContextType {
  reports: Report[];
  loading: boolean;
  error: string | null;
}

const ReportsContext = createContext<ReportsContextType | undefined>(undefined);

// ── Status logic (mirrors DashboardProvider) ──────────────────────────────────
function getStatusAndDetails(temp: number, humidity: number, pressure: number, gas: number): {
  status: Report['status'];
  details: string;
} {
  const parts: string[] = [];

  // Critical check
  if (temp > 45) parts.push(`Temp ${temp.toFixed(1)}°C`);
  if (humidity > 85) parts.push(`Humidity ${humidity.toFixed(1)}%`);
  if (pressure < 98 || pressure > 106) parts.push(`Pressure ${pressure} hPa`);
  if (gas > 500) parts.push(`Gas ${gas}`);

  if (
    temp > 45 || humidity > 85 ||
    pressure < 98 || pressure > 106 ||
    gas > 500
  ) return { status: 'Critical', details: `⛔ Critical: ${parts.join(', ')}` };

  // Warning check
  parts.length = 0;
  if (temp > 38) parts.push(`Temp ${temp.toFixed(1)}°C`);
  if (humidity > 75) parts.push(`Humidity ${humidity.toFixed(1)}%`);
  if (pressure < 100 || pressure > 104) parts.push(`Pressure ${pressure} hPa`);
  if (gas > 200) parts.push(`Gas ${gas}`);

  if (
    temp > 38 || humidity > 75 ||
    pressure < 100 || pressure > 104 ||
    gas > 200
  ) return { status: 'Warning', details: `⚠️ Warning: ${parts.join(', ')}` };

  return { status: 'Normal', details: 'All parameters within normal range' };
}

function extractFields(data: Record<string, number | string>) {
  const temp = parseFloat(String(data['temperature'] ?? data['temprature'] ?? data['temp'] ?? 0));
  const humidity = parseFloat(String(data['humidity'] ?? 0));
  const pressure = parseFloat(String(data['pressure'] ?? 102));
  const gas = parseFloat(String(data['gas_quality'] ?? data['gasQuality'] ?? 0));
  return {
    temp: isNaN(temp) ? 0 : Math.round(temp * 10) / 10,
    humidity: isNaN(humidity) ? 0 : Math.round(humidity * 10) / 10,
    pressure: isNaN(pressure) ? 102 : pressure,
    gas: isNaN(gas) ? 0 : gas,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export const ReportsProvider = ({ children }: { children: ReactNode }) => {
  const { emailReports } = useAppSettings();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const emailEnabledRef = useRef(emailReports);
  const prevLengthRef = useRef(0);
  const reportCounterRef = useRef(0);

  useEffect(() => { emailEnabledRef.current = emailReports; }, [emailReports]);

  useEffect(() => {
    let mounted = true;
    let recordsToStream: any[] = [];
    let currentIndex = 0;
    let streamTimer: NodeJS.Timeout;

    const processRow = (doc: any) => {
      if (!doc.data) return;

      const { temp, humidity, pressure, gas } = extractFields(doc.data);
      if (isNaN(temp) || isNaN(humidity)) return;

      const { status, details } = getStatusAndDetails(temp, humidity, pressure, gas);

      reportCounterRef.current += 1;
      const batchId = `B${String(reportCounterRef.current).padStart(5, '0')}`;

      const newReport: Report = {
        id: batchId,
        timestamp: new Date(doc.timestamp ?? Date.now()).toISOString(),
        status,
        details,
        temp,
        humidity,
        pressure,
        gasQuality: gas,
        equipment: `Sensor-${doc.sensorId ?? 1}`,
      };

      setReports((prev) => [newReport, ...prev].slice(0, 100));

      if (newReport.status !== 'Normal' && emailEnabledRef.current) {
        fetch('/api/send-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport),
        }).catch((err) => console.error('Alert email error:', err));
      }
    };

    const startStreaming = async () => {
      try {
        const res = await fetch(`/api/readings?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let raw: Array<any> = await res.json();
        if (!mounted) return;
        if (!Array.isArray(raw)) return;

        recordsToStream = raw.reverse();

        // Initial batch to populate reports immediately
        const initialBatch = recordsToStream.slice(0, 15);
        currentIndex = 15;

        for (const doc of initialBatch) {
          processRow(doc);
        }

        setLoading(false);
        setError(null);

        // Add a new row every 300ms to simulate fast real-time stream
        streamTimer = setInterval(() => {
          if (currentIndex < recordsToStream.length) {
            processRow(recordsToStream[currentIndex]);
            currentIndex++;
          } else {
            currentIndex = 0;
          }
        }, 300);

      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load data';
        setError(msg);
        setLoading(false);
      }
    };

    startStreaming();

    return () => { mounted = false; clearInterval(streamTimer); };
  }, []);

  return (
    <ReportsContext.Provider value={{ reports, loading, error }}>
      {children}
    </ReportsContext.Provider>
  );
};

export const useReports = (): ReportsContextType => {
  const context = useContext(ReportsContext);
  if (!context) throw new Error('useReports must be used within ReportsProvider');
  return context;
};