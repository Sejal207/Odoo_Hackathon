import apiClient from '../../../services/apiClient';

export const getMaintenanceRequests = async (status) => {
  try {
    const res = await apiClient.get('/maintenance', {
      params: status && status !== 'all' ? { status } : {},
    });
    const data = res.data?.data || res.data || {};
    const rawItems = Array.isArray(data) ? data : (data.items || []);
    const counts = data.counts || {};

    const items = rawItems.map((req) => ({
      id: req.id,
      assetTag: req.asset_tag || req.assetTag || 'AF-0000',
      issue: req.issue_description || req.issue || 'Maintenance required',
      createdAt: req.created_at || req.createdAt || new Date().toISOString(),
      priority: req.priority || 'medium',
      department: req.asset_department_id || req.department_name || req.department || 'General',
      status: req.status || 'pending',
    }));

    return {
      data: {
        items,
        counts,
      },
    };
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not load maintenance requests.');
  }
};

export const createMaintenanceRequest = async (payload) => {
  try {
    const res = await apiClient.post('/maintenance', payload);
    return { data: res.data?.data || res.data };
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not create maintenance request.');
  }
};

export const approveMaintenance = async (id) => {
  try {
    const res = await apiClient.patch(`/maintenance/${id}/approve`);
    return { data: res.data?.data || res.data };
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not approve maintenance.');
  }
};

export const assignTechnician = async (id, technician_name) => {
  try {
    const res = await apiClient.patch(`/maintenance/${id}/assign-technician`, { technician_name });
    return { data: res.data?.data || res.data };
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not assign technician.');
  }
};

export const startMaintenance = async (id) => {
  try {
    const res = await apiClient.patch(`/maintenance/${id}/start`);
    return { data: res.data?.data || res.data };
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not start maintenance.');
  }
};

export const resolveMaintenance = async (id, resolution_notes = '') => {
  try {
    const res = await apiClient.patch(`/maintenance/${id}/resolve`, { resolution_notes });
    return { data: res.data?.data || res.data };
  } catch (error) {
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Could not resolve maintenance.');
  }
};