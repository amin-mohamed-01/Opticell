'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Database, Filter, Plus, X, AlertTriangle, Pencil, Trash2 } from 'lucide-react';

type DataEntry = {
  id: number;
  report_id: number;
  maintenance_date: string;
  maintenance_type: string;
  notes: string;
  created_at: string;
};

const EMPTY_FORM = {
  report_id: '',
  maintenance_date: new Date().toISOString().split('T')[0],
  maintenance_type: 'inspection',
  notes: '',
};

const TYPE_COLORS: Record<string, string> = {
  inspection: 'bg-blue-50 text-blue-700 border-blue-200',
  repair:     'bg-amber-50 text-amber-700 border-amber-200',
  replace:    'bg-red-50  text-red-700  border-red-200',
};

export default function MaintenanceDataPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [data, setData]       = useState<DataEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch]   = useState('');

  // Delete confirm state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal / editing state
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataEntry | null>(null);
  const [submitting, setSubmitting]       = useState(false);

  // Form state
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    fetchData();
  }, []);

  /* ── helpers ───────────────────────────────────────────────── */

  const fetchData = async () => {
    try {
      setFetching(true);
      const res = await fetch('/api/maintenance-data');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch maintenance data');
      }
      setData(await res.json());
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setFetching(false);
    }
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (record: DataEntry) => {
    setEditingRecord(record);
    setFormData({
      report_id:        String(record.report_id),
      maintenance_date: record.maintenance_date.split('T')[0],
      maintenance_type: record.maintenance_type,
      notes:            record.notes || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        report_id: parseInt(formData.report_id),
        ...(editingRecord ? { id: editingRecord.id } : {}),
      };

      const res = await fetch('/api/maintenance-data', {
        method:  editingRecord ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save data');
      }

      await fetchData();
      closeModal();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/maintenance-data?id=${deletingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete record');
      }
      await fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleteLoading(false);
      setDeletingId(null);
    }
  };

  /* ── guards ────────────────────────────────────────────────── */

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user)   return null;

  const filtered = data.filter((d) =>
    d.report_id.toString().includes(search.toLowerCase()) ||
    (d.notes && d.notes.toLowerCase().includes(search.toLowerCase())) ||
    d.maintenance_type.toLowerCase().includes(search.toLowerCase())
  );

  const isEditing = editingRecord !== null;

  /* ── render ────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gray-50 relative">

      {/* ── Header ── */}
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
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Report Data
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {errorMsg && (
        <div className="px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">Database error: {errorMsg}. Ensure POSTGRES_URI is set.</p>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="px-8 py-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span>Filter:</span>
        </div>
        <input
          type="text"
          placeholder="Search by Report ID, type, or notes…"
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

      {/* ── Table ── */}
      <div className="px-8 pb-10">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Data ID', 'Report ID', 'Date', 'Type', 'Notes', 'Created At', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center text-gray-500">
                      Loading records…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center text-gray-500">
                      No data found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0"
                    >
                      <td className="px-5 py-4 text-sm font-mono font-medium text-gray-900">{d.id}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">Report #{d.report_id}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {new Date(d.maintenance_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize border ${
                            TYPE_COLORS[d.maintenance_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {d.maintenance_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                        {d.notes || '-'}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                      {/* ── Actions ── */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(d)}
                            title="Edit record"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingId(d.id)}
                            title="Delete record"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
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
                Are you sure you want to delete <span className="font-semibold text-gray-900">Data ID #{deletingId}</span>? This action cannot be undone.
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
                {deleteLoading ? 'Deleting…' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isEditing ? 'Edit Maintenance Data' : 'Add Maintenance Data'}
                </h2>
                {isEditing && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Data ID: <span className="font-mono font-semibold text-gray-600">{editingRecord!.id}</span>
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Report ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report ID <span className="text-gray-400 font-normal">(must exist in maintenance_report table)</span>
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  value={formData.report_id}
                  onChange={(e) => setFormData({ ...formData, report_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. 1"
                />
              </div>

              {/* Date + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Date</label>
                  <input
                    required
                    type="date"
                    value={formData.maintenance_date}
                    onChange={(e) => setFormData({ ...formData, maintenance_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.maintenance_type}
                    onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="inspection">Inspection</option>
                    <option value="repair">Repair</option>
                    <option value="replace">Replace</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Enter notes here…"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50"
                >
                  {submitting
                    ? isEditing ? 'Updating…' : 'Saving…'
                    : isEditing ? 'Update in Postgres' : 'Save to Postgres'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
