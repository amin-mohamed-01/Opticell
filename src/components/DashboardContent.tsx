// src/components/DashboardContent.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Legend,
} from 'recharts';
import { Bell, Thermometer, Droplets, Gauge, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/providers/AppProvider';
import { useDashboard, getStatusFromData } from '@/providers/DashboardProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardContent() {
  const { criticalAlerts, emailReports } = useAppSettings();
  const { chartData, currentStatus, latestData, batchReports, loadingError } = useDashboard();

  // Authentication
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  // ── Status derived from all 4 sensors ────────────────────────────────────
  const status     = latestData ? getStatusFromData(latestData) : 'normal';
  const isNormal   = status === 'normal';
  const isWarning  = status === 'warning';
  const isCritical = status === 'critical';

  const gaugeColor  = isNormal ? '#10B981' : isWarning ? '#FBBF24' : '#EF4444';
  const statusText  = isNormal ? 'Normal'  : isWarning ? 'Warning'  : 'Critical';
  const statusColor = isNormal ? 'text-green-600' : isWarning ? 'text-yellow-600' : 'text-red-600';

  const gaugeData = [{ value: currentStatus }];

  // ── Alert reasons ─────────────────────────────────────────────────────────
  const reasons: string[] = [];
  if (latestData) {
    const { temperature, humidity, pressure, gasQuality, vibration } = latestData;
    if (!isNormal) {
      if (temperature >= 55) reasons.push(`Temp critically high (${temperature.toFixed(1)}°C)`);
      else if (temperature >= 45) reasons.push(`Temp high (${temperature.toFixed(1)}°C)`);
      if (humidity >= 95) reasons.push(`Humidity critically high (${humidity.toFixed(1)}%)`);
      else if (humidity >= 85) reasons.push(`Humidity high (${humidity.toFixed(1)}%)`);
      if (pressure < 90 || pressure > 115) reasons.push(`Pressure out of range (${pressure} hPa)`);
      else if (pressure < 95 || pressure > 110) reasons.push(`Pressure abnormal (${pressure} hPa)`);
      if (gasQuality >= 700) reasons.push(`Gas quality critical (${gasQuality})`);
      else if (gasQuality >= 600) reasons.push(`Gas quality elevated (${gasQuality})`);
      if (vibration >= 20) reasons.push(`Vibration critical (${vibration})`);
      else if (vibration >= 10) reasons.push(`Vibration elevated (${vibration})`);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">OptiCell Bioreactor Dashboard</h1>
        <p className="text-gray-600 mt-2 flex items-center gap-2">
          <Bell className="w-4 h-4 text-green-500 animate-pulse" />
          Live streaming • Temperature · Humidity · Pressure · Gas Quality · Vibration
        </p>
      </div>

      {loadingError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <strong>Error:</strong> {loadingError}
        </div>
      )}

      {(criticalAlerts || emailReports) && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 text-blue-600" size={20} />
            <div>
              <p className="font-semibold text-blue-900">Active Settings</p>
              <p className="text-sm text-blue-700">
                {criticalAlerts && 'Critical Alerts'}
                {criticalAlerts && emailReports && ' • '}
                {emailReports && 'Email Reports'}
              </p>
            </div>
          </div>
        </div>
      )}


      {/* ── Chart + Gauge ─────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              Live Data Stream
              <div className="flex flex-wrap gap-4 text-sm">
                {[
                  { color: 'bg-blue-500',   label: 'Temp' },
                  { color: 'bg-teal-500',   label: 'Humidity' },
                  { color: 'bg-purple-500', label: 'Pressure' },
                  { color: 'bg-orange-500', label: 'Gas' },
                  { color: 'bg-pink-500', label: 'Vibration' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-full ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis yAxisId="left"  orientation="left"  stroke="#3b82f6" />
                <YAxis yAxisId="right" orientation="right" stroke="#14b8a6" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Legend />

                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="pressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="vibGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ec4899" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>

                <Area yAxisId="left"  type="monotone" dataKey="temperature" stroke="#3b82f6" fill="url(#tempGradient)"  strokeWidth={2} name="Temperature (°C)" />
                <Area yAxisId="right" type="monotone" dataKey="humidity"    stroke="#14b8a6" fill="url(#humGradient)"   strokeWidth={2} name="Humidity (%)" />
                <Area yAxisId="left"  type="monotone" dataKey="pressure"    stroke="#a855f7" fill="url(#pressGradient)" strokeWidth={2} name="Pressure (hPa)" />
                <Area yAxisId="right" type="monotone" dataKey="gasQuality"  stroke="#f97316" fill="url(#gasGradient)"  strokeWidth={2} name="Gas Quality" />
                <Area yAxisId="right" type="monotone" dataKey="vibration"  stroke="#ec4899" fill="url(#vibGradient)"  strokeWidth={2} name="Vibration" />
              </AreaChart>
            </ResponsiveContainer>

            {latestData && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-500">Temperature</p>
                  <p className="text-xl font-bold text-blue-600">{latestData.temperature.toFixed(1)} °C</p>
                </div>
                <div className="text-center p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <p className="text-xs text-gray-500">Humidity</p>
                  <p className="text-xl font-bold text-teal-600">{latestData.humidity.toFixed(1)} %</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-gray-500">Pressure</p>
                  <p className="text-xl font-bold text-purple-600">{latestData.pressure} hPa</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs text-gray-500">Gas Quality</p>
                  <p className="text-xl font-bold text-orange-600">{latestData.gasQuality}</p>
                </div>
                <div className="text-center p-3 bg-pink-50 rounded-lg border border-pink-200">
                  <p className="text-xs text-gray-500">Vibration</p>
                  <p className="text-xl font-bold text-pink-600">{latestData.vibration}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gauge */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={24} data={gaugeData} startAngle={180} endAngle={0}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={12} fill={gaugeColor} background={{ fill: '#e5e7eb' }} />
                <text x="50%" y="48%" textAnchor="middle" className="text-5xl font-bold fill-gray-900">{currentStatus}</text>
                <text x="50%" y="62%" textAnchor="middle" className="text-lg fill-gray-500">/ 100</text>
              </RadialBarChart>
            </ResponsiveContainer>
            <p className={cn('mt-6 text-3xl font-bold', statusColor)}>{statusText}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Batch Reports ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Batch Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Batch ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Details</th>
                </tr>
              </thead>
              <tbody>
                {batchReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-500">
                      {loadingError ? 'Failed to load data' : 'Waiting for first report...'}
                    </td>
                  </tr>
                ) : (
                  batchReports.map((report, index) => (
                    <tr key={`${report.id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm text-gray-700">{new Date(report.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-4 font-medium text-gray-900">{report.id}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full',
                            report.status === 'normal'   && 'bg-green-600',
                            report.status === 'warning'  && 'bg-yellow-600',
                            report.status === 'critical' && 'bg-red-600'
                          )} />
                          <span className={cn('font-medium',
                            report.status === 'normal'   && 'text-green-600',
                            report.status === 'warning'  && 'text-yellow-600',
                            report.status === 'critical' && 'text-red-600'
                          )}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{report.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Critical Alert Popup ──────────────────────────────────────────── */}
      {criticalAlerts && !isNormal && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className={cn('rounded-xl border p-6 shadow-xl', isWarning ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300')}>
            <div className="flex items-start gap-4">
              <Bell className={cn('h-6 w-6 mt-0.5', statusColor)} />
              <div>
                <h3 className={cn('text-lg font-bold', statusColor)}>{statusText} Alert</h3>
                <p className="mt-2 text-base text-gray-700">
                  {reasons.length > 0 ? reasons.join(' • ') :
                   isWarning ? 'Parameters approaching limits.' : 'Immediate action required.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}