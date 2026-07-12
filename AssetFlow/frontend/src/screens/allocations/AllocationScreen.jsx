import { useEffect, useState } from 'react';
import { ArrowRightLeft, Package, UserPlus } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusBadge';
import { useAuth } from '../../features/auth/hooks/useAuth';
import * as allocationsApi from '../../features/allocations/api/allocationsApi';

const STATUS_BADGES = {
  allocated: 'bg-slate-100 text-slate-600',
  available: 'bg-emerald-100 text-emerald-700',
};

const TABS = [
  { key: 'allocated', label: 'Allocated', icon: ArrowRightLeft },
  { key: 'unallocated', label: 'Unallocated', icon: Package },
];

export default function AllocationScreen() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'admin' || user?.role === 'asset_manager';

  const [activeTab, setActiveTab] = useState('allocated');
  const [allocatedAssets, setAllocatedAssets] = useState([]);
  const [unallocatedAssets, setUnallocatedAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modal, setModal] = useState(null); // { type: 'allocate' | 'transfer', asset: ... }
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [allocated, unallocated, emps] = await Promise.all([
        allocationsApi.getAllocatedAssets(),
        allocationsApi.getUnallocatedAssets(),
        allocationsApi.getEmployees(),
      ]);
      setAllocatedAssets(allocated);
      setUnallocatedAssets(unallocated);
      setEmployees(emps);
    } catch (err) {
      setError(err.message || 'Could not load allocation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (type, asset) => {
    setModal({ type, asset });
    setSelectedEmployee('');
    setReason('');
    setActionError('');
    setActionSuccess('');
  };

  const closeModal = () => {
    setModal(null);
    setSelectedEmployee('');
    setReason('');
    setActionError('');
    setActionSuccess('');
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) { setActionError('Please select an employee.'); return; }
    setSubmitting(true);
    setActionError('');
    try {
      await allocationsApi.allocateAsset(modal.asset.id, selectedEmployee);
      setActionSuccess('Asset allocated successfully!');
      setTimeout(() => { closeModal(); load(); }, 800);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) { setActionError('Please select an employee.'); return; }
    setSubmitting(true);
    setActionError('');
    try {
      await allocationsApi.directTransfer(modal.asset.id, selectedEmployee, reason);
      setActionSuccess('Asset transferred successfully!');
      setTimeout(() => { closeModal(); load(); }, 800);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (asset) => {
    if (!asset.allocation_id) return;
    try {
      await allocationsApi.returnAsset(asset.allocation_id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const currentList = activeTab === 'allocated' ? allocatedAssets : unallocatedAssets;

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#061E29]">Allocation & Transfer</h1>
        <span className="text-sm text-gray-400">
          {allocatedAssets.length} allocated · {unallocatedAssets.length} available
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === 'allocated' ? allocatedAssets.length : unallocatedAssets.length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-[#1D546D] bg-[#1D546D] text-white'
                  : 'border-gray-200 bg-white text-[#061E29] hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : currentList.length === 0 ? (
          <EmptyState message={
            activeTab === 'allocated'
              ? 'No assets are currently allocated.'
              : 'All assets are currently allocated.'
          } />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Asset Tag</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden sm:table-cell">Category</th>
                {activeTab === 'allocated' && (
                  <th className="px-4 py-3">Assigned To</th>
                )}
                <th className="px-4 py-3 hidden md:table-cell">Department</th>
                <th className="px-4 py-3">Status</th>
                {isPrivileged && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentList.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-[#1D546D]">{asset.asset_tag}</td>
                  <td className="px-4 py-3 font-medium text-[#061E29]">{asset.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{asset.category_name || '—'}</td>
                  {activeTab === 'allocated' && (
                    <td className="px-4 py-3 text-[#061E29]">{asset.employee_name}</td>
                  )}
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{asset.department_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      STATUS_BADGES[asset.status] || 'bg-slate-100 text-slate-600'
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  {isPrivileged && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab === 'allocated' ? (
                          <>
                            <button
                              onClick={() => openModal('transfer', asset)}
                              className="rounded-lg border border-[#1D546D] px-3 py-1.5 text-xs font-medium text-[#1D546D] hover:bg-[#1D546D] hover:text-white transition"
                            >
                              Transfer
                            </button>
                            <button
                              onClick={() => handleReturn(asset)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition"
                            >
                              Return
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openModal('allocate', asset)}
                            className="flex items-center gap-1 rounded-lg bg-[#1D546D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#061E29] transition"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Allocate
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-semibold text-[#061E29]">
              {modal.type === 'allocate' ? 'Allocate Asset' : 'Transfer Asset'}
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              {modal.asset.asset_tag} — {modal.asset.name}
            </p>

            {actionError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</div>
            )}
            {actionSuccess && (
              <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{actionSuccess}</div>
            )}

            <form onSubmit={modal.type === 'allocate' ? handleAllocate : handleTransfer} className="space-y-4">
              {modal.type === 'transfer' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#061E29]">Currently Assigned To</label>
                  <input
                    disabled
                    value={modal.asset.employee_name || '—'}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-[#061E29]">
                  {modal.type === 'allocate' ? 'Assign To' : 'Transfer To'}
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1D546D] focus:outline-none"
                >
                  <option value="">Select Employee...</option>
                  {employees
                    .filter((emp) => modal.type !== 'transfer' || emp.id !== modal.asset.employee_id)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                </select>
              </div>

              {modal.type === 'transfer' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#061E29]">Reason (optional)</label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide reason for transfer..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1D546D] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#1D546D] px-5 py-2 text-sm font-medium text-white hover:bg-[#061E29] disabled:opacity-50 transition"
                >
                  {submitting
                    ? (modal.type === 'allocate' ? 'Allocating...' : 'Transferring...')
                    : (modal.type === 'allocate' ? 'Allocate' : 'Transfer Now')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}