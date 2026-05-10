'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Database, Filter, Plus, X, AlertTriangle } from 'lucide-react';

type DataEntry = {
  id: number;
  report_id: number;
  maintenance_date: string;
  maintenance_type: string;
  notes: string;
  created_at: string;
};

export default function MaintenanceDataPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DataEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [search, setSearch] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    report_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    maintenance_type: 'inspection',
    notes: '',
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/maintenance-data');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch maintenance data');
      }
      const records = await res.json();
      setData(records);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        report_id: parseInt(formData.report_id),
      };

      const res = await fetch('/api/maintenance-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to insert data');
      }

      await fetchData();
      setIsModalOpen(false);
      setFormData({ 
        report_id: '', 
        maintenance_date: new Date().toISOString().split('T')[0], 
        maintenance_type: 'inspection', 
        notes: '' 
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  const filtered = data.filter((d) => 
    d.report_id.toString().includes(search.toLowerCase()) ||
    (d.notes && d.notes.toLowerCase().includes(search.toLowerCase())) ||
    d.maintenance_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Database className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Maintenance Report Data</h1>
              <p className="text-sm text-gray-500 mt-0.5">Engineer Report › Maintenance Report Data</p>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Report Data
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">Database connection error: {errorMsg}. Ensure POSTGRES_URI is set.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-8 py-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span>Filter:</span>
        </div>
        
        <input
          type="text"
          placeholder="Search by Report ID, type, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        />
        <button
          onClick={() => setSearch('')}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          Clear
        </button>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="px-8 pb-10">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Data ID', 'Report ID', 'Date', 'Type', 'Notes', 'Created At'].map((h) => (
                    <th key={h} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-gray-500">Loading records...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-gray-500">No data found.</td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                      <td className="px-5 py-4 text-sm font-mono font-medium text-gray-900">{d.id}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">Report #{d.report_id}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">{new Date(d.maintenance_date).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 capitalize border border-gray-200">
                          {d.maintenance_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 max-w-[200px] truncate">{d.notes || '-'}</td>
                      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">{new Date(d.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Add Maintenance Data</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Report ID (must exist in Maintenance Report table)</label>
                <input required type="number" value={formData.report_id} onChange={e => setFormData({...formData, report_id: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" placeholder="e.g. 1" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Date</label>
                  <input required type="date" value={formData.maintenance_date} onChange={e => setFormData({...formData, maintenance_date: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formData.maintenance_type} onChange={e => setFormData({...formData, maintenance_type: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white">
                    <option value="inspection">Inspection</option>
                    <option value="repair">Repair</option>
                    <option value="replace">Replace</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" placeholder="Enter notes here..."></textarea>
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save to Postgres'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
