import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2, Plus, Search, X, Wrench } from 'lucide-react';
import { createAsset, getAssetMetadata, getAssets, updateAsset } from '../../features/assets/api/assetsApi';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'available', label: 'Available' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'under_maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
  { value: 'lost', label: 'Lost' },
  { value: 'disposed', label: 'Disposed' },
];

const STATUS_BADGES = {
  available: 'bg-emerald-100 text-emerald-700',
  allocated: 'bg-slate-100 text-slate-600',
  reserved: 'bg-teal-100 text-teal-700',
  under_maintenance: 'bg-orange-100 text-orange-700',
  retired: 'bg-slate-100 text-slate-500',
  lost: 'bg-rose-100 text-rose-700',
  disposed: 'bg-slate-200 text-slate-600',
};

const EMPTY_FORM = {
  name: '',
  category_id: '',
  department_id: '',
  serial_number: '',
  location: '',
  qr_code: '',
  acquisition_cost: '',
  is_bookable: false,
};

const PAGE_SIZE = 10;

function prettyStatus(status) {
  if (status === 'under_maintenance') return 'Maintenance';
  return String(status || '').replaceAll('_', ' ');
}

function AssetStatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  const classes = STATUS_BADGES[key] || 'bg-slate-100 text-slate-600';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${classes}`}>
      {prettyStatus(status)}
    </span>
  );
}

export default function AssetsScreen() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [metadata, setMetadata] = useState({ categories: [], departments: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    let cancelled = false;

    const loadMetadata = async () => {
      try {
        const data = await getAssetMetadata();
        if (!cancelled) {
          setMetadata({
            categories: data?.categories || [],
            departments: data?.departments || [],
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load filter data.');
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAssets = async () => {
      setLoading(true);
      setError('');

      try {
        const params = {
          page,
          limit: PAGE_SIZE,
          tag: debouncedSearch || undefined,
          serial: debouncedSearch || undefined,
          category: categoryFilter || undefined,
          status: statusFilter || undefined,
          department: departmentFilter || undefined,
        };

        const data = await getAssets(params);
        if (cancelled) return;

        setAssets(data?.assets || []);
        setPagination(data?.pagination || { page, limit: PAGE_SIZE, total: 0, totalPages: 0 });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load assets.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, categoryFilter, statusFilter, departmentFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter, departmentFilter]);

  const filteredAssets = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    if (!term) return assets;

    return assets.filter((asset) => {
      const assetTag = String(asset.asset_tag || '').toLowerCase();
      const name = String(asset.name || '').toLowerCase();
      const serial = String(asset.serial_number || '').toLowerCase();
      const qrCode = String(asset.qr_code || '').toLowerCase();

      return assetTag.includes(term) || name.includes(term) || serial.includes(term) || qrCode.includes(term);
    });
  }, [assets, debouncedSearch]);

  const handleFilterSelect = (type, value) => {
    if (type === 'category') setCategoryFilter(value);
    if (type === 'status') setStatusFilter(value);
    if (type === 'department') setDepartmentFilter(value);
    setOpenDropdown(null);
  };

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const handleCreateAsset = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await createAsset({
        name: form.name.trim(),
        category_id: form.category_id,
        department_id: form.department_id || null,
        serial_number: form.serial_number || null,
        qr_code: form.qr_code || null,
        location: form.location || null,
        acquisition_cost: form.acquisition_cost ? Number(form.acquisition_cost) : null,
        is_bookable: form.is_bookable,
      });

      setIsRegisterModalOpen(false);
      resetForm();
      setPage(1);

      const data = await getAssets({
        page: 1,
        limit: PAGE_SIZE,
        tag: debouncedSearch || undefined,
        serial: debouncedSearch || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
      });

      setAssets(data?.assets || []);
      setPagination(data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.message || 'Could not create asset.');
    } finally {
      setSaving(false);
    }
  };

  const handlePutInMaintenance = async (assetId) => {
    try {
      await updateAsset(assetId, { status: 'under_maintenance' });
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, status: 'under_maintenance' } : a)));
    } catch (err) {
      setError(err.message || 'Could not put asset into maintenance.');
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:p-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm font-medium text-[#1D546D] hover:underline"
      >
        Back
      </button>

      <div>
        <h1 className="text-3xl font-bold text-[#061E29]">Assets</h1>
        <p className="mt-1 text-sm text-slate-500">Browse, search and manage every registered asset.</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by tag, serial, or QR code..."
            className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
          />
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-[#369588] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2f8176]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Register Asset
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterDropdown
          label={statusFilter ? prettyStatus(statusFilter) : 'Status'}
          open={openDropdown === 'status'}
          onToggle={() => setOpenDropdown((current) => (current === 'status' ? null : 'status'))}
        >
          {STATUS_OPTIONS.map((option) => (
            <DropdownItem key={option.value || 'all'} onClick={() => handleFilterSelect('status', option.value)}>
              {option.label}
            </DropdownItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label={categoryFilter ? getLabelById(metadata.categories, categoryFilter) : 'Category'}
          open={openDropdown === 'category'}
          onToggle={() => setOpenDropdown((current) => (current === 'category' ? null : 'category'))}
        >
          <DropdownItem onClick={() => handleFilterSelect('category', '')}>All Categories</DropdownItem>
          {metadata.categories.map((category) => (
            <DropdownItem key={category.id} onClick={() => handleFilterSelect('category', category.id)}>
              {category.name}
            </DropdownItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label={departmentFilter ? getLabelById(metadata.departments, departmentFilter) : 'Department'}
          open={openDropdown === 'department'}
          onToggle={() => setOpenDropdown((current) => (current === 'department' ? null : 'department'))}
        >
          <DropdownItem onClick={() => handleFilterSelect('department', '')}>All Departments</DropdownItem>
          {metadata.departments.map((department) => (
            <DropdownItem key={department.id} onClick={() => handleFilterSelect('department', department.id)}>
              {department.name}
            </DropdownItem>
          ))}
        </FilterDropdown>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Tag</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1D546D]" />
                    Loading assets...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                    No assets found.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-medium text-slate-900">{asset.asset_tag}</td>
                    <td className="px-6 py-4 text-slate-700">{asset.name}</td>
                    <td className="px-6 py-4 text-slate-600">{asset.category_name || 'Uncategorized'}</td>
                    <td className="px-6 py-4">
                      <AssetStatusBadge status={asset.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-600">{asset.location || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      {asset.status === 'available' && (
                        <button
                          onClick={() => handlePutInMaintenance(asset.id)}
                          className="inline-flex items-center rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
                          title="Put in Maintenance"
                        >
                          <Wrench className="mr-1.5 h-3.5 w-3.5" />
                          Maintenance
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
          <span>
            Showing {filteredAssets.length} of {pagination.total || 0} assets
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="min-w-20 text-center font-medium text-slate-700">
              {pagination.page || page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= (pagination.totalPages || 1)}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#061E29]">Register New Asset</h2>
                <p className="text-sm text-slate-500">Create a new asset record in the backend.</p>
              </div>
              <button onClick={() => setIsRegisterModalOpen(false)} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreateAsset}>
              <Field label="Asset Name" required>
                <input
                  value={form.name}
                  onChange={(event) => handleFormChange('name', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                  placeholder="e.g. MacBook Pro"
                  required
                />
              </Field>

              <Field label="Category" required>
                <select
                  value={form.category_id}
                  onChange={(event) => handleFormChange('category_id', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                  required
                >
                  <option value="">Select category</option>
                  {metadata.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Department">
                <select
                  value={form.department_id}
                  onChange={(event) => handleFormChange('department_id', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                >
                  <option value="">No department</option>
                  {metadata.departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Serial Number">
                <input
                  value={form.serial_number}
                  onChange={(event) => handleFormChange('serial_number', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                  placeholder="Serial number"
                />
              </Field>

              <Field label="QR Code">
                <input
                  value={form.qr_code}
                  onChange={(event) => handleFormChange('qr_code', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                  placeholder="QR code"
                />
              </Field>

              <Field label="Location">
                <input
                  value={form.location}
                  onChange={(event) => handleFormChange('location', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                  placeholder="e.g. HQ Floor 2"
                />
              </Field>

              <Field label="Acquisition Cost">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.acquisition_cost}
                  onChange={(event) => handleFormChange('acquisition_cost', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[#1D546D] focus:ring-2 focus:ring-[#1D546D]/10"
                  placeholder="Optional"
                />
              </Field>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_bookable}
                  onChange={(event) => handleFormChange('is_bookable', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1D546D] focus:ring-[#1D546D]"
                />
                This asset can be booked by users
              </label>

              <div className="flex justify-end gap-3 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-2xl bg-[#369588] px-5 py-3 font-semibold text-white transition hover:bg-[#2f8176] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function getLabelById(items, id) {
  return items.find((item) => item.id === id)?.name || 'Unknown';
}

function FilterDropdown({ label, open, onToggle, children }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        {label}
        <ChevronDown className="ml-2 h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700 sm:col-span-1">
      <span>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}