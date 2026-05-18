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
  if (d.temperature > 55) score -= 40;
  else if (d.temperature > 45) score -= 28;
  else if (d.temperature > 38) score -= 12;

  // Humidity
  if (d.humidity > 85) score -= 25;
  else if (d.humidity > 75) score -= 12;

  // Pressure
  if (d.pressure < 96 || d.pressure > 108) score -= 20;
  else if (d.pressure < 100 || d.pressure > 104) score -= 10;

  // Gas Quality
  if (d.gasQuality > 500) score -= 25;
  else if (d.gasQuality > 200) score -= 12;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Parsing ──────────────────────────────────────────────────────────────────
function parseReading(doc: {
  sensorId?: number;
  data?: Record<string, number | string>;
  _uploadedAt?: string;
}): SensorData | null {
  if (!doc.data) return null;

  const d = doc.data;

  const temperature =
    typeof d['temperature'] === 'number' ? d['temperature'] :
      typeof d['temprature'] === 'number' ? d['temprature'] :
        parseFloat(String(d['temperature'] ?? d['temprature'] ?? 0));

  const humidity = parseFloat(String(d['humidity'] ?? 0));
  const pressure = parseFloat(String(d['pressure'] ?? 102));
  const gasQuality = parseFloat(String(d['gas_quality'] ?? d['gasQuality'] ?? 0));

  if (isNaN(temperature) || isNaN(humidity)) return null;

  return {
    timestamp: new Date(doc._uploadedAt ?? Date.now()).toISOString(),
    temperature: temperature as number,
    humidity,
    pressure: isNaN(pressure) ? 102 : pressure,
    gasQuality: isNaN(gasQuality) ? 0 : gasQuality,
    equipment: `Sensor-${doc.sensorId ?? 1}`,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [chartData, setChartData] = useState<DashboardState['chartData']>([]);
  const [currentStatus, setCurrentStatus] = useState(85);
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const [batchReports, setBatchReports] = useState<BatchReport[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const reportCounterRef = useRef<number>(0);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let streamTimer: NodeJS.Timeout;

    const processRow = (doc: any) => {
      const row = parseReading(doc);
      if (!row) return;

      const timeLabel = new Date(row.timestamp).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      setChartData((prev) => {
        return [...prev, {
          time: timeLabel,
          temperature: row.temperature,
          humidity: row.humidity,
          pressure: row.pressure,
          gasQuality: row.gasQuality,
        }].slice(-30);
      });

      setLatestData(row);
      setCurrentStatus(calculateHealthScore(row));

      const shouldReport = Math.random() < 0.1;
      if (shouldReport) {
        const status = getStatusFromData(row);
        reportCounterRef.current += 1;
        setBatchReports((prev) =>
          [{
            id: `B${String(reportCounterRef.current).padStart(4, '0')}`,
            timestamp: row.timestamp,
            status,
            details:
              status === 'critical' ? buildCriticalDetails(row) :
                status === 'warning' ? buildWarningDetails(row) :
                  'Normal bioreactor operation',
          }, ...prev].slice(0, 10)
        );
      }
    };

    // Fetch the very next document from the cursor API
    const fetchNext = async () => {
      try {
        const url = lastIdRef.current
          ? `/api/stream?after=${lastIdRef.current}&t=${Date.now()}`
          : `/api/stream?t=${Date.now()}`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;

        const json = await res.json();
        if (!mounted) return;

        if (json.data) {
          // New document received — update cursor and render it
          lastIdRef.current = json.data._id;
          processRow(json.data);
          setLoadingError(null);
        }
        // If json.data is null → no new data yet, do nothing, just wait
      } catch (err) {
        // Silent fail — will retry on next tick
        console.error('[DashboardStream] fetch error:', err);
      }
    };

    // Kick off first fetch immediately, then poll every 300ms
    fetchNext();
    streamTimer = setInterval(fetchNext, 300);

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
  if (d.temperature > 45) parts.push(`Temp ${d.temperature.toFixed(1)}°C`);
  if (d.humidity > 85) parts.push(`Humidity ${d.humidity.toFixed(1)}%`);
  if (d.pressure < 98 || d.pressure > 106) parts.push(`Pressure ${d.pressure} hPa`);
  if (d.gasQuality > 500) parts.push(`Gas ${d.gasQuality}`);
  return parts.length ? `⛔ Critical: ${parts.join(', ')}` : 'Critical deviation detected';
}

function buildWarningDetails(d: SensorData): string {
  const parts: string[] = [];
  if (d.temperature > 38) parts.push(`Temp ${d.temperature.toFixed(1)}°C`);
  if (d.humidity > 75) parts.push(`Humidity ${d.humidity.toFixed(1)}%`);
  if (d.pressure < 100 || d.pressure > 104) parts.push(`Pressure ${d.pressure} hPa`);
  if (d.gasQuality > 200) parts.push(`Gas ${d.gasQuality}`);
  return parts.length ? `⚠️ Warning: ${parts.join(', ')}` : 'Parameters approaching limits';
}

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};