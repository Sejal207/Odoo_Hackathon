import apiClient from '../../../services/apiClient';

const getErrorMessage = (error, fallbackMessage) => {
  const responseMessage = error?.response?.data?.message || error?.response?.data?.error;
  if (responseMessage) return responseMessage;
  if (error?.message) return error.message;
  return fallbackMessage;
};

export const login = async (credentials) => {
  try {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  } catch (error) {
    const parsedError = new Error(getErrorMessage(error, 'Unable to sign in right now.'));
    parsedError.statusCode = error?.response?.status;
    parsedError.isNetworkError = !error?.response;
    throw parsedError;
  }
};

export const register = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

export const getProfile = async () => {
  try {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  } catch (error) {
    const parsedError = new Error(getErrorMessage(error, 'Unable to load user profile.'));
    parsedError.statusCode = error?.response?.status;
    parsedError.isNetworkError = !error?.response;
    throw parsedError;
  }
};