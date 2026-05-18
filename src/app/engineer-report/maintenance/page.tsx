'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Wrench, AlertTriangle, CheckCircle, Clock, Plus, X, Trash2 } from 'lucide-react';

type Report = {
  id: number;
  machine_id: number;
  alert_id: number;
  user_id: number;
  status: string;
  human_review: string;
  priority: string;
  created_at: string;
};

const severityBadge = (severity: string) => {
  switch (severity) {
    case 'high': return 'bg-red-100 text-red-700 border border-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'low': return 'bg-green-100 text-green-700 border border-green-200';
    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'done': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />;
    default: return <AlertTriangle className="w-4 h-4 text-red-500" />;
  }
};

export default function MaintenanceReportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [reports, setReports] = useState<Report[]>([]);
  const [fetching, setFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    machine_id: '1',
    alert_id: '1',
    status: 'open',
    priority: 'medium',
    human_review: '',
  });

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/maintenance');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch reports');
      }
      const data = await res.json();
      setReports(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/maintenance?id=${deletingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete report');
      }
      await fetchReports();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleteLoading(false);
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        machine_id: parseInt(formData.machine_id),
        alert_id: parseInt(formData.alert_id),
        user_id: 1, // Mock user ID since Postgres uses INT
      };

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create report');
      }

      await fetchReports();
      setIsModalOpen(false);
      setFormData({ machine_id: '1', alert_id: '1', status: 'open', priority: 'medium', human_review: '' });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Wrench className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Maintenance Report</h1>
              <p className="text-sm text-gray-500 mt-0.5">Engineer Report › Maintenance Report</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-8 py-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Reports', value: reports.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Done', value: reports.filter(r => r.status === 'done').length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Open / In Progress', value: reports.filter(r => r.status !== 'done').length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl ${card.bg} px-6 py-5 border border-gray-100`}>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="px-8 mb-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">Database connection error: {errorMsg}. Ensure POSTGRES_URI is set.</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="px-8 pb-10">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Report ID', 'Date', 'Machine ID', 'Alert ID', 'Review', 'Priority', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td colSpan={8} className="px-8 py-16 text-center text-gray-500">Loading records...</td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-8 py-16 text-center text-gray-500">No reports found.</td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{r.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Machine #{r.machine_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Alert #{r.alert_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">{r.human_review || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${severityBadge(r.priority)}`}>
                          {r.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 capitalize">
                          {statusIcon(r.status)}
                          {r.status.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setDeletingId(r.id)}
                          title="Delete report"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Confirm Delete</h2>
              <button onClick={() => setDeletingId(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-semibold text-gray-900">Report #{deletingId}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end px-6 pb-5">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting…' : 'Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Create Maintenance Report</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Machine ID</label>
                  <input required type="number" value={formData.machine_id} onChange={e => setFormData({ ...formData, machine_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert ID</label>
                  <input required type="number" value={formData.alert_id} onChange={e => setFormData({ ...formData, alert_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Human Review (Notes)</label>
                <textarea rows={3} value={formData.human_review} onChange={e => setFormData({ ...formData, human_review: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Describe the issue or review..."></textarea>
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
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
