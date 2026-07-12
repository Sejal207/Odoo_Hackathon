import apiClient from '../../../services/apiClient';

const unwrapData = (response) => response?.data?.data ?? response?.data;

const parseError = (error, fallbackMessage) => {
  const message = error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.message
    || fallbackMessage;

  const parsed = new Error(message);
  parsed.statusCode = error?.response?.status;
  parsed.isNetworkError = !error?.response;
  throw parsed;
};

export const getAssets = async (params = {}) => {
  try {
    const response = await apiClient.get('/assets', { params });
    return unwrapData(response);
  } catch (error) {
    return parseError(error, 'Unable to load assets right now.');
  }
};

export const getAssetMetadata = async () => {
  try {
    const response = await apiClient.get('/assets/meta');
    return unwrapData(response);
  } catch (error) {
    return parseError(error, 'Unable to load asset metadata right now.');
  }
};

export const createAsset = async (payload) => {
  try {
    const response = await apiClient.post('/assets', payload);
    return unwrapData(response);
  } catch (error) {
    return parseError(error, 'Unable to create asset right now.');
  }
};

export const updateAsset = async (id, payload) => {
  try {
    const response = await apiClient.patch(`/assets/${id}`, payload);
    return unwrapData(response);
  } catch (error) {
    return parseError(error, 'Unable to update asset right now.');
  }
};