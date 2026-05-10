// src/providers/DashboardProvider.tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SensorData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  gasQuality: number;
  equipment: string;
}

interface BatchReport {
  id: string;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
  details: string;
}

interface DashboardState {
  chartData: { time: string; temperature: number; humidity: number; pressure: number; gasQuality: number }[];
  currentStatus: number;
  latestData: SensorData | null;
  batchReports: BatchReport[];
  loadingError: string | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const DashboardContext = createContext<DashboardState | undefined>(undefined);

// ─── Status Logic ─────────────────────────────────────────────────────────────
export function getStatusFromData(d: SensorData): 'normal' | 'warning' | 'critical' {
  // Critical thresholds
  if (
    d.temperature > 45 ||
    d.humidity > 85 ||
    d.pressure < 98 || d.pressure > 106 ||
    d.gasQuality > 500
  ) return 'critical';

  // Warning thresholds
  if (
    d.temperature > 38 ||
    d.humidity > 75 ||
    d.pressure < 100 || d.pressure > 104 ||
    d.gasQuality > 200
  ) return 'warning';

  return 'normal';
}

export function calculateHealthScore(d: SensorData): number {
  let score = 100;

  // Temperature
  if      (d.temperature > 55) score -= 40;
  else if (d.temperature > 45) score -= 28;
  else if (d.temperature > 38) score -= 12;

  // Humidity
  if      (d.humidity > 85) score -= 25;
  else if (d.humidity > 75) score -= 12;

  // Pressure
  if      (d.pressure < 96 || d.pressure > 108) score -= 20;
  else if (d.pressure < 100 || d.pressure > 104) score -= 10;

  // Gas Quality
  if      (d.gasQuality > 500) score -= 25;
  else if (d.gasQuality > 200) score -= 12;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Parsing ──────────────────────────────────────────────────────────────────
function parseReading(doc: {
  sensorId?: number;
  data?: Record<string, number | string>;
  timestamp?: string;
}): SensorData | null {
  if (!doc.data) return null;

  const d = doc.data;

  const temperature =
    typeof d['temperature'] === 'number' ? d['temperature'] :
    typeof d['temprature']  === 'number' ? d['temprature']  :
    parseFloat(String(d['temperature'] ?? d['temprature'] ?? 0));

  const humidity    = parseFloat(String(d['humidity']    ?? 0));
  const pressure    = parseFloat(String(d['pressure']    ?? 102));
  const gasQuality  = parseFloat(String(d['gas_quality'] ?? d['gasQuality'] ?? 0));

  if (isNaN(temperature) || isNaN(humidity)) return null;

  return {
    timestamp:   new Date(doc.timestamp ?? Date.now()).toISOString(),
    temperature: temperature as number,
    humidity,
    pressure:    isNaN(pressure)   ? 102 : pressure,
    gasQuality:  isNaN(gasQuality) ? 0   : gasQuality,
    equipment:  `Sensor-${doc.sensorId ?? 1}`,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [chartData,     setChartData]     = useState<DashboardState['chartData']>([]);
  const [currentStatus, setCurrentStatus] = useState(85);
  const [latestData,    setLatestData]    = useState<SensorData | null>(null);
  const [batchReports,  setBatchReports]  = useState<BatchReport[]>([]);
  const [loadingError,  setLoadingError]  = useState<string | null>(null);

  const reportCounterRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    let recordsToStream: any[] = [];
    let currentIndex = 0;
    let streamTimer: NodeJS.Timeout;

    const processRow = (doc: any) => {
      const row = parseReading(doc);
      if (!row) return;

      const timeLabel = new Date(row.timestamp).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      setChartData((prev) =>
        [...prev, {
          time: timeLabel,
          temperature: row.temperature,
          humidity: row.humidity,
          pressure: row.pressure,
          gasQuality: row.gasQuality,
        }].slice(-30)
      );
      setLatestData(row);
      setCurrentStatus(calculateHealthScore(row));

      // Simulate periodic batch reports (roughly 10% chance per new record)
      const shouldReport = Math.random() < 0.1;
      if (shouldReport) {
          const status = getStatusFromData(row);
          reportCounterRef.current += 1;
          setBatchReports((prev) =>
            [{
              id:        `B${String(reportCounterRef.current).padStart(4, '0')}`,
              timestamp: row.timestamp,
              status,
              details:
                status === 'critical' ? buildCriticalDetails(row) :
                status === 'warning'  ? buildWarningDetails(row)  :
                'Normal bioreactor operation',
            }, ...prev].slice(0, 10)
          );
      }
    };

    const startStreaming = async () => {
      try {
        const res = await fetch(`/api/readings?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        let raw: Array<any> = await res.json();
        if (!mounted) return;
        if (!Array.isArray(raw) || raw.length === 0) return;

        // /api/readings returns newest first. Reverse to chronological order for charts.
        recordsToStream = raw.reverse();

        // Push the first 15 instantly so the dashboard isn't completely empty
        const initialBatch = recordsToStream.slice(0, 15);
        currentIndex = 15;

        for (const doc of initialBatch) {
           processRow(doc);
        }

        // Add a new row every 300ms to simulate fast real-time stream
        streamTimer = setInterval(() => {
           if (currentIndex < recordsToStream.length) {
              processRow(recordsToStream[currentIndex]);
              currentIndex++;
           } else {
              // loop back to the beginning of the stream when we run out
              currentIndex = 0;
           }
        }, 300);

        setLoadingError(null);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to read data';
        setLoadingError(msg);
      }
    };

    startStreaming();

    return () => {
      mounted = false;
      clearInterval(streamTimer);
    };
  }, []);

  return (
    <DashboardContext.Provider
      value={{ chartData, currentStatus, latestData, batchReports, loadingError }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// ─── Detail helpers ───────────────────────────────────────────────────────────
function buildCriticalDetails(d: SensorData): string {
  const parts: string[] = [];
  if (d.temperature > 45)                         parts.push(`Temp ${d.temperature.toFixed(1)}°C`);
  if (d.humidity    > 85)                         parts.push(`Humidity ${d.humidity.toFixed(1)}%`);
  if (d.pressure < 98 || d.pressure > 106)        parts.push(`Pressure ${d.pressure} hPa`);
  if (d.gasQuality  > 500)                        parts.push(`Gas ${d.gasQuality}`);
  return parts.length ? `⛔ Critical: ${parts.join(', ')}` : 'Critical deviation detected';
}

function buildWarningDetails(d: SensorData): string {
  const parts: string[] = [];
  if (d.temperature > 38)                         parts.push(`Temp ${d.temperature.toFixed(1)}°C`);
  if (d.humidity    > 75)                         parts.push(`Humidity ${d.humidity.toFixed(1)}%`);
  if (d.pressure < 100 || d.pressure > 104)       parts.push(`Pressure ${d.pressure} hPa`);
  if (d.gasQuality  > 200)                        parts.push(`Gas ${d.gasQuality}`);
  return parts.length ? `⚠️ Warning: ${parts.join(', ')}` : 'Parameters approaching limits';
}

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};