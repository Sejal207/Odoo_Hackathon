import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, ShieldAlert, Building2, Package, Users,
  Search, ChevronDown, Plus, Pencil, MoreVertical,
  ChevronRight, ChevronLeft, X, Tag, Cpu, Armchair, Car, BookOpen,
  Loader2, AlertCircle
} from 'lucide-react';
import {
  getDepartments, createDepartment, updateDepartment, deactivateDepartment,
  getCategories, createCategory, updateCategory, deactivateCategory,
  getEmployees, updateEmployee, updateEmployeeRole, updateEmployeeStatus,
} from '../../services/orgApi';

// ─── Role maps (DB value ↔ UI label) ─────────────────────────────────────────
const ROLE_API_TO_UI = {
  admin: 'Admin',
  asset_manager: 'Asset Manager',
  department_head: 'Department Head',
  employee: 'Employee',
};
const ROLE_UI_TO_API = Object.fromEntries(
  Object.entries(ROLE_API_TO_UI).map(([k, v]) => [v, k])
);
const UI_ROLES = Object.values(ROLE_API_TO_UI);

// ─── Data transformers (API shape → UI shape) ────────────────────────────────
const initials = (name) => {
  if (!name) return '??';
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '??';
};

const toDeptUI = (d) => ({
  id: d.id,
  name: d.name || 'Unknown',
  abbr: (d.name || '').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 4),
  headName: d.headUserName || '—',
  headEmail: '',
  headInitials: initials(d.headUserName),
  parent: d.parentDepartmentName || '—',
  employees: Number(d.employeeCount) || 0,
  status: d.status === 'active' ? 'Active' : 'Inactive',
});

const toCatUI = (c) => ({
  id: c.id,
  name: c.name,
  icon: c.customFields?.icon || 'cpu',
  description: c.customFields?.description || '',
  assetCount: Number(c.assetCount) || 0,
  status: 'Active',   // asset_categories has no status column in live DB
});

const toEmpUI = (e) => ({
  id: e.id,
  name: e.name,
  email: e.email,
  role: ROLE_API_TO_UI[e.role] || e.role,
  dept: e.departmentName || '—',
  deptId: e.departmentId || null,
  initials: initials(e.name),
  status: e.status === 'active' ? 'Active' : 'Inactive',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CategoryIcon = ({ icon, className }) => {
  switch (icon) {
    case 'cpu': return <Cpu className={className} />;
    case 'chair': return <Armchair className={className} />;
    case 'car': return <Car className={className} />;
    default: return <BookOpen className={className} />;
  }
};

const StatusBadge = ({ status }) => (
  <div className="flex items-center gap-2">
    <div className={`w-2 h-2 rounded-full ${status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    <span className={`font-medium ${status === 'Active' ? 'text-emerald-700' : 'text-slate-500'}`}>{status}</span>
  </div>
);

const LoadingRow = ({ cols }) => (
  <tr>
    <td colSpan={cols} className="px-6 py-10 text-center">
      <div className="flex justify-center items-center gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading…</span>
      </div>
    </td>
  </tr>
);

const ErrorRow = ({ cols, message }) => (
  <tr>
    <td colSpan={cols} className="px-6 py-10 text-center">
      <div className="flex justify-center items-center gap-2 text-red-400">
        <AlertCircle className="w-5 h-5" />
        <span>{message}</span>
      </div>
    </td>
  </tr>
);

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#369588] bg-white';

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saveLabel, saving }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors disabled:opacity-50">Cancel</button>
      <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#369588] hover:bg-[#2c7a6f] rounded-lg transition-colors disabled:opacity-50">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saveLabel}
      </button>
    </div>
  );
}

// ─── Departments Tab ──────────────────────────────────────────────────────────

function DepartmentsTab({ departments, loading, error, reload }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showStatusDD, setShowStatusDD] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const [form, setForm] = useState({ name: '', abbr: '', parentId: '', headName: '', headEmail: '' });

  const filtered = departments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.abbr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const closeModal = () => { setIsAddOpen(false); setEditDept(null); setApiErr(''); };

  const openAdd = () => {
    setEditDept(null);
    setForm({ name: '', abbr: '', parentId: '', headName: '', headEmail: '' });
    setApiErr('');
    setIsAddOpen(true);
  };

  const openEdit = (dept) => {
    setEditDept(dept);
    // Find parentId from departments list
    const parent = departments.find(d => d.name === dept.parent);
    setForm({ name: dept.name, abbr: dept.abbr, parentId: parent?.id || '', headName: dept.headName, headEmail: dept.headEmail });
    setApiErr('');
    setIsAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        parent_department_id: form.parentId || null,
      };
      if (editDept) {
        await updateDepartment(editDept.id, payload);
      } else {
        await createDepartment(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setApiErr(err?.response?.data?.error?.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (dept) => {
    if (dept.status !== 'Active') return; // no reactivate endpoint
    try {
      await deactivateDepartment(dept.id);
      reload();
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Could not deactivate department.');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Toolbar */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Departments</h2>
          <p className="text-sm text-slate-500">Create and manage departments and their hierarchy.</p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDD(v => !v)}
              className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {statusFilter}
              <ChevronDown className="ml-2 h-4 w-4" />
            </button>
            {showStatusDD && (
              <div className="absolute top-full mt-1 left-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                {['All Status', 'Active', 'Inactive'].map(s => (
                  <button
                    key={s}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${statusFilter === s ? 'text-[#369588] font-semibold' : 'text-slate-700'}`}
                    onClick={() => { setStatusFilter(s); setShowStatusDD(false); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-64 pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#369588] bg-white text-sm"
              placeholder="Search department..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={openAdd}
            className="flex items-center justify-center px-4 py-2 bg-[#0a3143] text-white rounded-lg hover:bg-[#072432] transition-colors font-medium text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Department
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Head</th>
                <th className="px-6 py-4 font-semibold">Parent Department</th>
                <th className="px-6 py-4 font-semibold text-center">Employees</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : error ? (
                <ErrorRow cols={6} message={error} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-400">No departments match your search.</td>
                </tr>
              ) : filtered.map(dept => (
                <tr key={dept.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#e8f1ef] flex items-center justify-center text-[#369588]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{dept.name}</p>
                        <p className="text-xs text-slate-500">{dept.abbr}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-xs">
                        {dept.headInitials}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{dept.headName}</p>
                        <p className="text-xs text-slate-500">{dept.headEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{dept.parent}</td>
                  <td className="px-6 py-4 text-center font-medium">{dept.employees}</td>
                  <td className="px-6 py-4"><StatusBadge status={dept.status} /></td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(dept)} className="p-1.5 text-slate-400 hover:text-[#369588] border border-slate-200 rounded hover:border-[#369588] transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(dept)}
                        disabled={dept.status !== 'Active'}
                        className="p-1.5 text-slate-400 hover:text-orange-500 border border-slate-200 rounded hover:border-orange-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={dept.status === 'Active' ? 'Deactivate' : 'Already inactive'}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-white">
          <p className="text-sm text-slate-500">Showing {filtered.length} of {departments.length} departments</p>
          <div className="flex gap-1">
            <button className="p-1 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40" disabled><ChevronLeft className="w-5 h-5" /></button>
            <button className="px-3 py-1 bg-[#0a3143] text-white rounded text-sm font-medium">1</button>
            <button className="p-1 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40" disabled><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {/* Hierarchy Preview */}
      <div>
        <h3 className="text-lg font-bold text-[#0a3143] mb-4">Department Hierarchy Preview</h3>
        <div className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto shadow-sm">
          {departments.length === 0 ? (
            <p className="text-slate-400 text-sm">No departments yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 min-w-max">
              {/* Root departments */}
              {departments.filter(d => d.parent === '—').map(root => (
                <div key={root.id} className="flex flex-col gap-2">
                  <HierarchyNode label={root.name} abbr={root.abbr} />
                  {departments.filter(d => d.parent === root.name).map(child => (
                    <div key={child.id} className="flex items-center gap-2 ml-6">
                      <Arrow short />
                      <HierarchyNode label={child.name} abbr={child.abbr} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isAddOpen && (
        <Modal title={editDept ? 'Edit Department' : 'Add New Department'} onClose={closeModal}>
          <div className="space-y-4">
            <FormField label="Department Name">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Marketing" />
            </FormField>
            <FormField label="Abbreviation">
              <input type="text" value={form.abbr} onChange={e => setForm(f => ({ ...f, abbr: e.target.value }))} className={inputCls} placeholder="e.g. MKT (display only)" />
            </FormField>
            <FormField label="Parent Department">
              <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} className={inputCls}>
                <option value="">None</option>
                {departments.filter(d => !editDept || d.id !== editDept.id).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Head Name">
              <input type="text" value={form.headName} onChange={e => setForm(f => ({ ...f, headName: e.target.value }))} className={inputCls} placeholder="e.g. Jane Smith (display only)" />
            </FormField>
            <FormField label="Head Email">
              <input type="email" value={form.headEmail} onChange={e => setForm(f => ({ ...f, headEmail: e.target.value }))} className={inputCls} placeholder="e.g. jane@company.com (display only)" />
            </FormField>
            {apiErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiErr}</p>}
          </div>
          <ModalFooter onCancel={closeModal} onSave={handleSave} saveLabel={editDept ? 'Save Changes' : 'Add Department'} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

function HierarchyNode({ label, abbr }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm min-w-[150px]">
      <div className="w-7 h-7 rounded-full bg-[#e8f1ef] flex items-center justify-center text-[#369588] shrink-0">
        <Building2 className="w-4 h-4" />
      </div>
      <div>
        <p className="font-bold text-slate-900 text-xs leading-tight">{label}</p>
        <p className="text-[10px] text-slate-500">{abbr}</p>
      </div>
    </div>
  );
}

function Arrow({ short }) {
  return (
    <div className="flex items-center shrink-0">
      <div className={`${short ? 'w-4' : 'w-6'} h-px bg-slate-300`} />
      <div className="border-y-[4px] border-y-transparent border-l-[5px] border-l-slate-300" />
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ categories, loading, error, reload }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const [form, setForm] = useState({ name: '', description: '', icon: 'cpu' });

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const closeModal = () => { setIsAddOpen(false); setEditCat(null); setApiErr(''); };

  const openAdd = () => {
    setEditCat(null);
    setForm({ name: '', description: '', icon: 'cpu' });
    setApiErr('');
    setIsAddOpen(true);
  };

  const openEdit = (cat) => {
    setEditCat(cat);
    setForm({ name: cat.name, description: cat.description, icon: cat.icon });
    setApiErr('');
    setIsAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        customFields: { icon: form.icon, description: form.description },
      };
      if (editCat) {
        await updateCategory(editCat.id, payload);
      } else {
        await createCategory(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setApiErr(err?.response?.data?.error?.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    // Categories have no reactivate endpoint; deactivate only when Active
    try {
      await deactivateCategory(cat.id);
      reload();
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Could not deactivate category.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Asset Categories</h2>
          <p className="text-sm text-slate-500">Define and manage asset category types.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input type="text" className="block w-64 pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#369588] bg-white text-sm" placeholder="Search categories..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={openAdd} className="flex items-center justify-center px-4 py-2 bg-[#0a3143] text-white rounded-lg hover:bg-[#072432] transition-colors font-medium text-sm">
            <Plus className="h-4 w-4 mr-2" />Add Category
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center gap-2 text-slate-400 py-10">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading…</span>
        </div>
      ) : error ? (
        <div className="flex justify-center items-center gap-2 text-red-400 py-10">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <p className="col-span-4 text-center text-slate-400 py-10">No categories match your search.</p>
          ) : filtered.map(cat => (
            <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#e8f1ef] flex items-center justify-center text-[#369588]">
                  <CategoryIcon icon={cat.icon} className="w-6 h-6" />
                </div>
                <StatusBadge status={cat.status} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{cat.name}</h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">{cat.description}</p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Tag className="w-3 h-3" /> <span>{cat.assetCount} assets</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cat)} className="p-1.5 text-slate-400 hover:text-[#369588] border border-slate-200 rounded hover:border-[#369588] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleToggleStatus(cat)} className="p-1.5 text-slate-400 hover:text-orange-500 border border-slate-200 rounded hover:border-orange-300 transition-colors">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddOpen && (
        <Modal title={editCat ? 'Edit Category' : 'Add New Category'} onClose={closeModal}>
          <div className="space-y-4">
            <FormField label="Category Name">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Software" />
            </FormField>
            <FormField label="Description">
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls + ' resize-none'} placeholder="Brief description..." />
            </FormField>
            <FormField label="Icon">
              <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className={inputCls}>
                <option value="cpu">Electronics (Chip)</option>
                <option value="chair">Furniture (Chair)</option>
                <option value="car">Vehicle (Car)</option>
                <option value="book">Shared Space (Book)</option>
              </select>
            </FormField>
            {apiErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiErr}</p>}
          </div>
          <ModalFooter onCancel={closeModal} onSave={handleSave} saveLabel={editCat ? 'Save Changes' : 'Add Category'} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab({ employees, loading, error, reload, departments }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [showRoleDD, setShowRoleDD] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  const [form, setForm] = useState({ name: '', email: '', role: 'Employee', deptId: '' });

  const filtered = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || e.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const closeModal = () => { setIsAddOpen(false); setEditEmp(null); setApiErr(''); };

  const openEdit = (emp) => {
    setEditEmp(emp);
    setForm({ name: emp.name, email: emp.email, role: emp.role, deptId: emp.deptId || '' });
    setApiErr('');
    setIsAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (!editEmp) {
      // No POST /employees — employees are created via auth/invite flow
      setApiErr('New employees must be invited via the auth flow. Only existing employees can be edited here.');
      return;
    }
    setSaving(true);
    setApiErr('');
    try {
      const calls = [];
      // Name / department update
      calls.push(updateEmployee(editEmp.id, {
        name: form.name.trim(),
        department_id: form.deptId || null,
      }));
      // Role update (separate endpoint)
      if (form.role !== editEmp.role) {
        calls.push(updateEmployeeRole(editEmp.id, ROLE_UI_TO_API[form.role]));
      }
      await Promise.all(calls);
      closeModal();
      reload();
    } catch (err) {
      setApiErr(err?.response?.data?.error?.message || 'An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'Active' ? 'inactive' : 'active';
    try {
      await updateEmployeeStatus(emp.id, newStatus);
      reload();
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Could not update employee status.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Employees</h2>
          <p className="text-sm text-slate-500">Manage your employee directory.</p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Role filter */}
          <div className="relative">
            <button onClick={() => setShowRoleDD(v => !v)} className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              {roleFilter}<ChevronDown className="ml-2 h-4 w-4" />
            </button>
            {showRoleDD && (
              <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                {['All Roles', ...UI_ROLES].map(r => (
                  <button key={r} className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${roleFilter === r ? 'text-[#369588] font-semibold' : 'text-slate-700'}`} onClick={() => { setRoleFilter(r); setShowRoleDD(false); }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input type="text" className="block w-64 pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#369588] bg-white text-sm" placeholder="Search employees..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <button onClick={() => { setEditEmp(null); setForm({ name: '', email: '', role: 'Employee', deptId: departments[0]?.id || '' }); setApiErr(''); setIsAddOpen(true); }} className="flex items-center justify-center px-4 py-2 bg-[#0a3143] text-white rounded-lg hover:bg-[#072432] transition-colors font-medium text-sm">
            <Plus className="h-4 w-4 mr-2" />Add Employee
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Department</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={5} />
            ) : error ? (
              <ErrorRow cols={5} message={error} />
            ) : filtered.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-400">No employees match your search.</td></tr>
            ) : filtered.map(emp => (
              <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#e8f1ef] flex items-center justify-center text-[#369588] font-semibold text-xs">{emp.initials}</div>
                    <div>
                      <p className="font-semibold text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{emp.role}</span>
                </td>
                <td className="px-6 py-4 text-slate-700">{emp.dept}</td>
                <td className="px-6 py-4"><StatusBadge status={emp.status} /></td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => openEdit(emp)} className="p-1.5 text-slate-400 hover:text-[#369588] border border-slate-200 rounded hover:border-[#369588] transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleToggleStatus(emp)} className="p-1.5 text-slate-400 hover:text-orange-500 border border-slate-200 rounded hover:border-orange-300 transition-colors"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-white">
          <p className="text-sm text-slate-500">Showing {filtered.length} of {employees.length} employees</p>
          <div className="flex gap-1">
            <button className="p-1 rounded text-slate-400 disabled:opacity-40" disabled><ChevronLeft className="w-5 h-5" /></button>
            <button className="px-3 py-1 bg-[#0a3143] text-white rounded text-sm font-medium">1</button>
            <button className="p-1 rounded text-slate-400 disabled:opacity-40" disabled><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {isAddOpen && (
        <Modal title={editEmp ? 'Edit Employee' : 'Add New Employee'} onClose={closeModal}>
          <div className="space-y-4">
            <FormField label="Full Name">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. John Doe" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} readOnly={!!editEmp} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls + (editEmp ? ' bg-slate-50 cursor-not-allowed' : '')} placeholder="e.g. john@company.com" />
            </FormField>
            <FormField label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                {UI_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Department">
              <select value={form.deptId} onChange={e => setForm(f => ({ ...f, deptId: e.target.value }))} className={inputCls}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            {apiErr && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiErr}</p>}
          </div>
          <ModalFooter onCancel={closeModal} onSave={handleSave} saveLabel={editEmp ? 'Save Changes' : 'Add Employee'} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrganizationSetupScreen() {
  const [activeTab, setActiveTab] = useState('departments');

  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState('');

  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState('');

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState('');

  const loadDepartments = useCallback(async () => {
    setDeptLoading(true);
    setDeptError('');
    try {
      const data = await getDepartments();
      setDepartments((data || []).map(toDeptUI));
    } catch (err) {
      setDeptError(err?.response?.data?.error?.message || 'Failed to load departments.');
    } finally {
      setDeptLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    setCatError('');
    try {
      const data = await getCategories();
      setCategories((data || []).map(toCatUI));
    } catch (err) {
      setCatError(err?.response?.data?.error?.message || 'Failed to load categories.');
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    setEmpError('');
    try {
      const data = await getEmployees();
      setEmployees((data || []).map(toEmpUI));
    } catch (err) {
      setEmpError(err?.response?.data?.error?.message || 'Failed to load employees.');
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);
  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const tabs = [
    { key: 'departments', label: 'Departments', sub: 'Manage organizational structure', Icon: Building2 },
    { key: 'categories', label: 'Categories', sub: 'Manage asset categories', Icon: Package },
    { key: 'employees', label: 'Employees', sub: 'Manage employee directory', Icon: Users },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full bg-[#f8fafc]">

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Organization Setup</h1>
            <Settings className="w-5 h-5 text-[#369588]" />
          </div>
          <p className="text-sm text-slate-500">Manage departments, asset categories and employees.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-[#369588]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Admin Only</p>
            <p className="text-xs text-slate-500">Only administrators can manage organization data.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-6 border-b border-slate-200 mb-8">
        {tabs.map(({ key, label, sub, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 w-full px-6 py-4 text-left border-b-2 transition-all duration-200 ${activeTab === key
              ? 'border-[#369588] text-[#369588] bg-[#369588]/5'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs opacity-80">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'departments' && (
        <DepartmentsTab
          departments={departments}
          loading={deptLoading}
          error={deptError}
          reload={loadDepartments}
        />
      )}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          loading={catLoading}
          error={catError}
          reload={loadCategories}
        />
      )}
      {activeTab === 'employees' && (
        <EmployeesTab
          employees={employees}
          loading={empLoading}
          error={empError}
          reload={loadEmployees}
          departments={departments}
        />
      )}

    </div>
  );
}
