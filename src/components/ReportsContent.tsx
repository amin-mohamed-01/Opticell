// src/components/ReportsContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useReports, Report } from '@/providers/ReportsProvider';
import { utils, writeFile } from 'xlsx';

export default function ReportsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  const { reports, loading, error } = useReports();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = reports.filter((r) =>
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    if (filteredReports.length === 0) return;

    const exportData = filteredReports.map((r) => ({
      Timestamp: new Date(r.timestamp).toLocaleString(),
      'Batch ID': r.id,
      Status: r.status,
      'Temperature (°C)': r.temp.toFixed(1),
      'Humidity (%)': r.humidity.toFixed(1),
      'Pressure (hPa)': r.pressure,
      'Gas Quality': r.gasQuality,
      'Vibration': r.vibration,
      Details: r.details,
    }));

    const worksheet = utils.json_to_sheet(exportData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Reports');
    writeFile(workbook, 'reports_file.xlsx');
  };

  const badgeClass = (status: Report['status']) => {
    switch (status) {
      case 'Normal':   return 'bg-green-100 text-green-700 border border-green-200';
      case 'Warning':  return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
      case 'Critical': return 'bg-red-100 text-red-700 border border-red-200';
      default:         return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading bioreactor data...</div>
      </div>
    );

  if (error)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-red-600">
        <div className="text-xl">Error: {error}</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredReports.length} record{filteredReports.length !== 1 ? 's' : ''} shown
            </p>
          </div>
          <button
            onClick={handleExport}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Export All
          </button>
        </div>
      </div>

      <div className="px-8 py-8">
        {/* Search */}
        <div className="mb-6 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search by Batch ID, status or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-5 py-3 text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={() => setSearchTerm('')}
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'Timestamp', 'Batch ID', 'Status',
                    'Temperature', 'Humidity', 'Pressure', 'Gas Quality', 'Vibration',
                    'Details',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-8 py-16 text-center text-gray-500">
                      No reports found.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report, index) => (
                    <tr key={`${report.id}-${index}`} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {new Date(report.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">
                        {report.id}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(report.status)}`}>
                          {report.status}
                        </span>
                      </td>
                      {/* Temperature — color coded */}
                      <td className={`px-6 py-4 text-sm font-medium ${
                        report.temp >= 55 ? 'text-red-600' :
                        report.temp >= 45 ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {report.temp.toFixed(1)} °C
                      </td>
                      {/* Humidity */}
                      <td className={`px-6 py-4 text-sm font-medium ${
                        report.humidity >= 95 ? 'text-red-600' :
                        report.humidity >= 85 ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {report.humidity.toFixed(1)} %
                      </td>
                      {/* Pressure */}
                      <td className={`px-6 py-4 text-sm font-medium ${
                        (report.pressure < 90 || report.pressure > 115) ? 'text-red-600' :
                        (report.pressure < 95 || report.pressure > 110) ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {report.pressure} hPa
                      </td>
                      {/* Gas Quality */}
                      <td className={`px-6 py-4 text-sm font-medium ${
                        report.gasQuality >= 700 ? 'text-red-600' :
                        report.gasQuality >= 600 ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {report.gasQuality}
                      </td>
                      {/* Vibration */}
                      <td className={`px-6 py-4 text-sm font-medium ${
                        report.vibration >= 1.35 ? 'text-red-600' :
                        report.vibration >= 1.2 ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {report.vibration}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        {report.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}