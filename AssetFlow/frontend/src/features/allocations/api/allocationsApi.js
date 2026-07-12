import apiClient from '../../../services/apiClient';

/**
 * Fetch all allocated assets (assets with status "allocated" + their active allocation info).
 */
export const getAllocatedAssets = async () => {
  try {
    // Get allocated assets
    const assetRes = await apiClient.get('/assets', { params: { status: 'allocated', limit: 200 } });
    const assets = assetRes.data?.data?.assets || assetRes.data?.assets || [];

    // Get all active allocations
    const allocRes = await apiClient.get('/allocations', { params: { status: 'active', limit: 200 } });
    const allocs = allocRes.data?.data?.allocations || allocRes.data?.allocations || [];

    // Build a map: asset_id -> allocation (supporting string & number keys)
    const allocMap = {};
    for (const a of allocs) {
      allocMap[a.asset_id] = a;
      allocMap[String(a.asset_id)] = a;
      allocMap[Number(a.asset_id)] = a;
    }

    return assets.map((asset) => {
      const alloc = allocMap[asset.id] || allocMap[String(asset.id)] || allocMap[Number(asset.id)];
      return {
        id: asset.id,
        asset_tag: asset.asset_tag,
        name: asset.name,
        status: asset.status,
        category_name: asset.category_name || '',
        department_name: asset.department_name || '',
        location: asset.location || '',
        allocation_id: asset.allocation_id || alloc?.id || null,
        employee_name: asset.employee_name || alloc?.employee_name || 'Assigned Employee',
        employee_id: asset.employee_id || alloc?.employee_id || null,
        allocated_date: alloc?.allocated_date || null,
        expected_return_date: alloc?.expected_return_date || null,
      };
    });
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not load allocated assets.');
  }
};

/**
 * Fetch all unallocated (available) assets.
 */
export const getUnallocatedAssets = async () => {
  try {
    const res = await apiClient.get('/assets', { params: { status: 'available', limit: 200 } });
    const assets = res.data?.data?.assets || res.data?.assets || [];
    return assets.map((a) => ({
      id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      status: a.status,
      category_name: a.category_name || '',
      department_name: a.department_name || '',
      location: a.location || '',
    }));
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not load available assets.');
  }
};

/**
 * Allocate an unallocated asset to an employee.
 */
export const allocateAsset = async (assetId, employeeId) => {
  try {
    const res = await apiClient.post('/allocations', {
      asset_id: assetId,
      employee_id: employeeId,
    });
    return res.data?.data || res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not allocate asset.');
  }
};

/**
 * Direct transfer — admin/asset_manager only. Instantly re-assigns allocated asset.
 */
export const directTransfer = async (assetId, toEmployeeId, reason) => {
  try {
    const res = await apiClient.post('/allocations/direct-transfer', {
      asset_id: assetId,
      to_employee_id: toEmployeeId,
      reason: reason || '',
    });
    return res.data?.data || res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not transfer asset.');
  }
};

/**
 * Return an allocated asset.
 */
export const returnAsset = async (allocationId) => {
  try {
    const res = await apiClient.post(`/allocations/${allocationId}/return`, {});
    return res.data?.data || res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not return asset.');
  }
};

/**
 * Get list of employees for allocation/transfer dropdowns.
 */
export const getEmployees = async () => {
  try {
    const res = await apiClient.get('/auth/users');
    const users = res.data?.data || res.data || [];
    return users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
    }));
  } catch (error) {
    return [];
  }
};