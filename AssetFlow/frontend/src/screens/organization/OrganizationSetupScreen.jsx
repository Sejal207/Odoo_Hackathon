import React, { useState } from 'react';
import {
  Settings, ShieldAlert, Building2, Package, Users,
  Search, ChevronDown, Plus, Pencil, MoreVertical,
  ChevronRight, ChevronLeft, X, Tag, Cpu, Armchair, Car, BookOpen
} from 'lucide-react';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_DEPARTMENTS = [
  { id: '1', name: 'Engineering', abbr: 'ENG', headName: 'Aditi Rao', headEmail: 'aditi@company.com', headInitials: 'AR', parent: '—', employees: 42, status: 'Active' },
  { id: '2', name: 'Facilities', abbr: 'FAC', headName: 'Rohan Mehta', headEmail: 'rohan@company.com', headInitials: 'RM', parent: '—', employees: 18, status: 'Active' },
  { id: '3', name: 'Field Ops (East)', abbr: 'FO-E', headName: 'Sana Iqbal', headEmail: 'sana@company.com', headInitials: 'SI', parent: 'Field Ops', employees: 27, status: 'Inactive' },
  { id: '4', name: 'Field Ops (West)', abbr: 'FO-W', headName: 'Vikram Kumar', headEmail: 'vikram@company.com', headInitials: 'VK', parent: 'Field Ops', employees: 25, status: 'Active' },
  { id: '5', name: 'IT Department', abbr: 'IT', headName: 'Neeraj Pandey', headEmail: 'neeraj@company.com', headInitials: 'NP', parent: '—', employees: 12, status: 'Active' },
];

const INITIAL_CATEGORIES = [
  { id: '1', name: 'Electronics', icon: 'cpu', assetCount: 24, description: 'Laptops, monitors, peripherals and other electronic devices', status: 'Active' },
  { id: '2', name: 'Furniture', icon: 'chair', assetCount: 15, description: 'Desks, chairs, cabinets and other office furniture', status: 'Active' },
  { id: '3', name: 'Vehicles', icon: 'car', assetCount: 6, description: 'Fleet vehicles, vans and company transport', status: 'Active' },
  { id: '4', name: 'Shared Spaces', icon: 'book', assetCount: 4, description: 'Conference rooms and bookable shared spaces', status: 'Active' },
];

const INITIAL_EMPLOYEES = [
  { id: '1', name: 'Alice Admin', email: 'admin@example.com', role: 'Admin', dept: 'Engineering', initials: 'AA', status: 'Active' },
  { id: '2', name: 'Bob Manager', email: 'bob@example.com', role: 'Asset Manager', dept: 'Operations', initials: 'BM', status: 'Active' },
  { id: '3', name: 'Charlie Head', email: 'charlie@example.com', role: 'Department Head', dept: 'Engineering', initials: 'CH', status: 'Active' },
  { id: '4', name: 'Dave Emp', email: 'dave@example.com', role: 'Employee', dept: 'Engineering', initials: 'DE', status: 'Active' },
  { id: '5', name: 'Eve Emp', email: 'eve@example.com', role: 'Employee', dept: 'HR', initials: 'EE', status: 'Inactive' },
];

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function DepartmentsTab({ departments, setDepartments }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showStatusDD, setShowStatusDD] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editDept, setEditDept] = useState(null);

  // New dept form state
  const [form, setForm] = useState({ name: '', abbr: '', parent: 'None', headName: '', headEmail: '' });

  const filtered = departments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.abbr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editDept) {
      setDepartments(prev => prev.map(d => d.id === editDept.id ? { ...d, ...form } : d));
    } else {
      setDepartments(prev => [...prev, {
        id: String(Date.now()), ...form,
        headInitials: form.headName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        employees: 0, status: 'Active',
      }]);
    }
    setForm({ name: '', abbr: '', parent: 'None', headName: '', headEmail: '' });
    setIsAddOpen(false);
    setEditDept(null);
  };

  const openEdit = (dept) => {
    setEditDept(dept);
    setForm({ name: dept.name, abbr: dept.abbr, parent: dept.parent, headName: dept.headName, headEmail: dept.headEmail });
    setIsAddOpen(true);
  };

  const toggleStatus = (id) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, status: d.status === 'Active' ? 'Inactive' : 'Active' } : d));
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
            onClick={() => { setEditDept(null); setForm({ name: '', abbr: '', parent: 'None', headName: '', headEmail: '' }); setIsAddOpen(true); }}
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
              {filtered.length === 0 ? (
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
                      <button onClick={() => toggleStatus(dept.id)} className="p-1.5 text-slate-400 hover:text-orange-500 border border-slate-200 rounded hover:border-orange-300 transition-colors" title="Toggle Status">
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
          <div className="flex items-center gap-2 min-w-max">
            {/* Head Office */}
            <HierarchyNode label="Head Office" abbr="ROOT" />
            <Arrow />
            <HierarchyNode label="Engineering" abbr="ENG" />
            <Arrow />
            <HierarchyNode label="Field Ops" abbr="FO" />
            <div className="flex flex-col gap-3 ml-2">
              <div className="flex items-center gap-2">
                <Arrow short />
                <HierarchyNode label="Field Ops (East)" abbr="FO-E" />
              </div>
              <div className="flex items-center gap-2">
                <Arrow short />
                <HierarchyNode label="Field Ops (West)" abbr="FO-W" />
                <Arrow />
                <HierarchyNode label="Facilities" abbr="FAC" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isAddOpen && (
        <Modal title={editDept ? 'Edit Department' : 'Add New Department'} onClose={() => { setIsAddOpen(false); setEditDept(null); }}>
          <div className="space-y-4">
            <FormField label="Department Name" placeholder="e.g. Marketing">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Marketing" />
            </FormField>
            <FormField label="Abbreviation">
              <input type="text" value={form.abbr} onChange={e => setForm(f => ({ ...f, abbr: e.target.value }))} className={inputCls} placeholder="e.g. MKT" />
            </FormField>
            <FormField label="Parent Department">
              <select value={form.parent} onChange={e => setForm(f => ({ ...f, parent: e.target.value }))} className={inputCls}>
                <option>None</option>
                {departments.filter(d => !editDept || d.id !== editDept.id).map(d => <option key={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Head Name">
              <input type="text" value={form.headName} onChange={e => setForm(f => ({ ...f, headName: e.target.value }))} className={inputCls} placeholder="e.g. Jane Smith" />
            </FormField>
            <FormField label="Head Email">
              <input type="email" value={form.headEmail} onChange={e => setForm(f => ({ ...f, headEmail: e.target.value }))} className={inputCls} placeholder="e.g. jane@company.com" />
            </FormField>
          </div>
          <ModalFooter onCancel={() => { setIsAddOpen(false); setEditDept(null); }} onSave={handleSave} saveLabel={editDept ? 'Save Changes' : 'Add Department'} />
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

function CategoriesTab({ categories, setCategories }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', icon: 'cpu' });

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editCat) {
      setCategories(prev => prev.map(c => c.id === editCat.id ? { ...c, ...form } : c));
    } else {
      setCategories(prev => [...prev, { id: String(Date.now()), assetCount: 0, status: 'Active', ...form }]);
    }
    setForm({ name: '', description: '', icon: 'cpu' });
    setIsAddOpen(false); setEditCat(null);
  };

  const openEdit = (cat) => { setEditCat(cat); setForm({ name: cat.name, description: cat.description, icon: cat.icon }); setIsAddOpen(true); };
  const toggleStatus = (id) => setCategories(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } : c));

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
          <button onClick={() => { setEditCat(null); setForm({ name: '', description: '', icon: 'cpu' }); setIsAddOpen(true); }} className="flex items-center justify-center px-4 py-2 bg-[#0a3143] text-white rounded-lg hover:bg-[#072432] transition-colors font-medium text-sm">
            <Plus className="h-4 w-4 mr-2" />Add Category
          </button>
        </div>
      </div>

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
                <button onClick={() => toggleStatus(cat.id)} className="p-1.5 text-slate-400 hover:text-orange-500 border border-slate-200 rounded hover:border-orange-300 transition-colors">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAddOpen && (
        <Modal title={editCat ? 'Edit Category' : 'Add New Category'} onClose={() => { setIsAddOpen(false); setEditCat(null); }}>
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
          </div>
          <ModalFooter onCancel={() => { setIsAddOpen(false); setEditCat(null); }} onSave={handleSave} saveLabel={editCat ? 'Save Changes' : 'Add Category'} />
        </Modal>
      )}
    </div>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

const ROLES = ['Admin', 'Asset Manager', 'Department Head', 'Employee'];

function EmployeesTab({ employees, setEmployees, departments }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [showRoleDD, setShowRoleDD] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'Employee', dept: departments[0]?.name || '' });

  const filtered = employees.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || e.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editEmp) {
      setEmployees(prev => prev.map(e => e.id === editEmp.id ? { ...e, ...form, initials: form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) } : e));
    } else {
      setEmployees(prev => [...prev, {
        id: String(Date.now()), ...form,
        initials: form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        status: 'Active',
      }]);
    }
    setForm({ name: '', email: '', role: 'Employee', dept: departments[0]?.name || '' });
    setIsAddOpen(false); setEditEmp(null);
  };

  const openEdit = (emp) => { setEditEmp(emp); setForm({ name: emp.name, email: emp.email, role: emp.role, dept: emp.dept }); setIsAddOpen(true); };
  const toggleStatus = (id) => setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: e.status === 'Active' ? 'Inactive' : 'Active' } : e));

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
                {['All Roles', ...ROLES].map(r => (
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

          <button onClick={() => { setEditEmp(null); setForm({ name: '', email: '', role: 'Employee', dept: departments[0]?.name || '' }); setIsAddOpen(true); }} className="flex items-center justify-center px-4 py-2 bg-[#0a3143] text-white rounded-lg hover:bg-[#072432] transition-colors font-medium text-sm">
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
            {filtered.length === 0 ? (
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
                    <button onClick={() => toggleStatus(emp.id)} className="p-1.5 text-slate-400 hover:text-orange-500 border border-slate-200 rounded hover:border-orange-300 transition-colors"><MoreVertical className="w-4 h-4" /></button>
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
        <Modal title={editEmp ? 'Edit Employee' : 'Add New Employee'} onClose={() => { setIsAddOpen(false); setEditEmp(null); }}>
          <div className="space-y-4">
            <FormField label="Full Name">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. John Doe" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="e.g. john@company.com" />
            </FormField>
            <FormField label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Department">
              <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))} className={inputCls}>
                {departments.map(d => <option key={d.id}>{d.name}</option>)}
              </select>
            </FormField>
          </div>
          <ModalFooter onCancel={() => { setIsAddOpen(false); setEditEmp(null); }} onSave={handleSave} saveLabel={editEmp ? 'Save Changes' : 'Add Employee'} />
        </Modal>
      )}
    </div>
  );
}

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

function ModalFooter({ onCancel, onSave, saveLabel }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">Cancel</button>
      <button onClick={onSave} className="px-4 py-2 text-sm font-medium text-white bg-[#369588] hover:bg-[#2c7a6f] rounded-lg transition-colors">{saveLabel}</button>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrganizationSetupScreen() {
  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState(INITIAL_DEPARTMENTS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);

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
      {/* <div className="flex gap-6 border-b border-slate-200 mb-8">
        {tabs.map(({ key, label, sub, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 pb-4 px-1 border-b-2 transition-colors ${activeTab === key ? 'border-[#369588] text-[#369588]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs font-normal opacity-80">{sub}</p>
            </div>
          </button>
        ))}
      </div> */}


      {/* Tabs */}
      <div className="grid grid-cols-3 gap-6 border-b border-slate-200 mb-8">
        {tabs.map(({ key, label, sub, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 w-full px-6 py-4 text-left border-b-2 transition-all duration-200 ${activeTab === key
                ? "border-[#369588] text-[#369588] bg-[#369588]/5"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
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
      {activeTab === 'departments' && <DepartmentsTab departments={departments} setDepartments={setDepartments} />}
      {activeTab === 'categories' && <CategoriesTab categories={categories} setCategories={setCategories} />}
      {activeTab === 'employees' && <EmployeesTab employees={employees} setEmployees={setEmployees} departments={departments} />}

    </div>
  );
}
