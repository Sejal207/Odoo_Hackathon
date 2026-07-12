import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Plus, X } from 'lucide-react';

// Mock data to be replaced with actual API call
const mockAssets = [
  { id: '1', tag: 'AF-0012', name: 'Dell Latitude Laptop', category: 'Electronics', status: 'Allocated', location: 'Bengaluru' },
  { id: '2', tag: 'AF-0062', name: 'Epson Projector', category: 'Electronics', status: 'Maintenance', location: 'HQ Floor 2' },
  { id: '3', tag: 'AF-0201', name: 'Ergonomic Office Chair', category: 'Furniture', status: 'Available', location: 'Warehouse' },
  { id: '4', tag: 'AF-0114', name: 'MacBook Pro 14"', category: 'Electronics', status: 'Allocated', location: 'Mumbai' },
  { id: '5', tag: 'AF-0332', name: 'Standing Desk', category: 'Furniture', status: 'Reserved', location: 'HQ Floor 3' },
  { id: '6', tag: 'AF-0407', name: 'Conference Speaker', category: 'Electronics', status: 'Available', location: 'HQ Floor 1' },
  { id: '7', tag: 'AF-0510', name: 'Toyota Fleet Van', category: 'Vehicle', status: 'Allocated', location: 'Depot' },
  { id: '8', tag: 'AF-0588', name: 'Whiteboard Mobile', category: 'Furniture', status: 'Retired', location: 'Warehouse' },
  { id: '9', tag: 'AF-0621', name: 'HP LaserJet Printer', category: 'Electronics', status: 'Maintenance', location: 'HQ Floor 2' },
  { id: '10', tag: 'AF-0703', name: 'Cisco Network Switch', category: 'Electronics', status: 'Available', location: 'Server Room' },
];

const getStatusBadge = (status) => {
  switch (status.toLowerCase()) {
    case 'allocated':
      return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Allocated</span>;
    case 'maintenance':
      return <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">Maintenance</span>;
    case 'available':
      return <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-xs font-medium">Available</span>;
    case 'reserved':
      return <span className="px-3 py-1 bg-teal-100 text-teal-600 rounded-full text-xs font-medium">Reserved</span>;
    case 'retired':
      return <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">Retired</span>;
    default:
      return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{status}</span>;
  }
};

export default function AssetsScreen() {
  const [assets, setAssets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    // Simulate API fetch
    const fetchAssets = async () => {
      setIsLoading(true);
      try {
        // Replace with actual API call:
        // const response = await fetch('/api/assets');
        // const data = await response.json();

        // Using mock data for now
        setTimeout(() => {
          setAssets(mockAssets);
          setIsLoading(false);
        }, 300);
      } catch (error) {
        console.error("Failed to fetch assets:", error);
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, []);

  const filteredAssets = assets.filter(asset =>
    asset.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full bg-[#f8fafc]">
      {/* Header section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Assets</h1>
        <p className="text-sm text-slate-500">Browse, search and manage every registered asset.</p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#369588] focus:border-transparent bg-white text-sm"
            placeholder="Search by tag, serial, or QR code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="flex items-center justify-center px-4 py-2.5 bg-[#369588] text-white rounded-lg hover:bg-[#2c7a6f] transition-colors font-medium text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Register Asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'Category' ? null : 'Category')}
            className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Category
            <ChevronDown className="ml-2 h-4 w-4" />
          </button>
          {openDropdown === 'Category' && (
            <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10">
              {['Electronics', 'Furniture', 'Vehicle', 'Shared Spaces'].map(cat => (
                <button key={cat} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'Status' ? null : 'Status')}
            className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Status
            <ChevronDown className="ml-2 h-4 w-4" />
          </button>
          {openDropdown === 'Status' && (
            <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10">
              {['Allocated', 'Available', 'Maintenance', 'Reserved', 'Retired'].map(status => (
                <button key={status} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'Department' ? null : 'Department')}
            className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Department
            <ChevronDown className="ml-2 h-4 w-4" />
          </button>
          {openDropdown === 'Department' && (
            <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10">
              {['Engineering', 'HR', 'Operations', 'Finance'].map(dept => (
                <button key={dept} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  {dept}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase text-slate-500 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">TAG</th>
                <th className="px-6 py-4 font-semibold">NAME</th>
                <th className="px-6 py-4 font-semibold">CATEGORY</th>
                <th className="px-6 py-4 font-semibold">STATUS</th>
                <th className="px-6 py-4 font-semibold">LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    Loading assets...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No assets found.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{asset.tag}</td>
                    <td className="px-6 py-4 text-slate-700">{asset.name}</td>
                    <td className="px-6 py-4">{asset.category}</td>
                    <td className="px-6 py-4">{getStatusBadge(asset.status)}</td>
                    <td className="px-6 py-4">{asset.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Asset Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">Register New Asset</h2>
              <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
                <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#369588]" placeholder="e.g. MacBook Pro" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#369588]">
                  <option>Electronics</option>
                  <option>Furniture</option>
                  <option>Vehicle</option>
                  <option>Shared Spaces</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#369588]" placeholder="e.g. HQ Floor 2" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsRegisterModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={() => setIsRegisterModalOpen(false)} className="px-4 py-2 text-sm font-medium text-white bg-[#369588] hover:bg-[#2c7a6f] rounded-lg transition-colors">
                Save Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
