import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/StatusBadge';
import * as maintenanceApi from '../../features/maintenance/api/maintenanceApi';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'technician_assigned', label: 'Technician Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

export default function MaintenanceScreen() {
  const [activeTab, setActiveTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    maintenanceApi
      .getMaintenanceRequests(activeTab)
      .then((res) => {
        setRequests(res.data?.items || res.data || []);
        setCounts(res.data?.counts || {});
      })
      .catch((err) => setError(err.message || 'Could not load maintenance requests.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [activeTab]);

  const handleAction = async (req, action) => {
    try {
      if (action === 'approve') {
        await maintenanceApi.approveMaintenance(req.id);
      } else if (action === 'assign') {
        const techName = window.prompt('Enter Technician Name:');
        if (!techName) return;
        await maintenanceApi.assignTechnician(req.id, techName);
      } else if (action === 'start') {
        await maintenanceApi.startMaintenance(req.id);
      } else if (action === 'resolve') {
        const notes = window.prompt('Enter Resolution Notes (optional):');
        if (notes === null) return;
        await maintenanceApi.resolveMaintenance(req.id, notes);
      }
      load();
    } catch (err) {
      alert(err.message || 'Could not perform action.');
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#061E29]">Maintenance Management</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-[#1D546D] bg-[#1D546D] text-white'
                : 'border-gray-200 bg-white text-[#061E29] hover:bg-gray-50'
            }`}
          >
            {tab.label} {counts[tab.key] != null && `(${counts[tab.key]})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-xl border border-gray-200 bg-white p-2">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : requests.length === 0 ? (
          <EmptyState message="No maintenance requests in this stage." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {requests.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F4]">
                    <Wrench className="h-4 w-4 text-[#1D546D]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#061E29]">
                      {req.assetTag} — {req.issue}
                    </p>
                    <p className="text-xs text-gray-400">
                      Requested: {new Date(req.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · Priority: {req.priority}
                    </p>
                  </div>
                </div>
                <span className="hidden text-sm text-gray-500 sm:block">{req.department}</span>
                <div className="flex items-center gap-4">
                  <StatusBadge status={req.status} />
                  {req.status === 'pending' && (
                    <button onClick={() => handleAction(req, 'approve')} className="rounded-lg bg-[#369588] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2f8176]">
                      Approve
                    </button>
                  )}
                  {req.status === 'approved' && (
                    <button onClick={() => handleAction(req, 'assign')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      Assign Tech
                    </button>
                  )}
                  {req.status === 'technician_assigned' && (
                    <button onClick={() => handleAction(req, 'start')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                      Start Progress
                    </button>
                  )}
                  {req.status === 'in_progress' && (
                    <button onClick={() => handleAction(req, 'resolve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}