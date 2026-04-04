import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },
  login: async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: async () => {
    const response = await api.get('/api/dashboard/stats');
    return response.data;
  },
  getConsumptionHistory: async () => {
    const response = await api.get('/api/dashboard/consumption-history');
    return response.data;
  },
  getZoneConsumption: async () => {
    const response = await api.get('/api/dashboard/zone-consumption');
    return response.data;
  },
};

// Zones APIs
export const zonesAPI = {
  getAll: async () => {
    const response = await api.get('/api/zones');
    return response.data;
  },
  create: async (zoneData) => {
    const response = await api.post('/api/zones', zoneData);
    return response.data;
  },
};

// Leaks APIs
export const leaksAPI = {
  getAll: async (status = null) => {
    const url = status ? `/api/leaks?status=${status}` : '/api/leaks';
    const response = await api.get(url);
    return response.data;
  },
  create: async (leakData) => {
    const response = await api.post('/api/leaks', leakData);
    return response.data;
  },
  updateStatus: async (leakId, status) => {
    const response = await api.patch(`/api/leaks/${leakId}/status`, null, {
      params: { status },
    });
    return response.data;
  },
};

// AI APIs
export const aiAPI = {
  analyze: async (analysisRequest) => {
    const response = await api.post('/api/ai/analyze', analysisRequest);
    return response.data;
  },
  getForecasts: async (zoneId = null) => {
    const url = zoneId ? `/api/forecasts?zone_id=${zoneId}` : '/api/forecasts';
    const response = await api.get(url);
    return response.data;
  },
};

// Analytics APIs
export const analyticsAPI = {
  getHeatmap: async () => {
    const response = await api.get('/api/analytics/heatmap');
    return response.data;
  },
  getTrends: async (period = 'week') => {
    const response = await api.get(`/api/analytics/trends?period=${period}`);
    return response.data;
  },
};

// Notifications APIs
export const notificationsAPI = {
  getAll: async () => {
    const response = await api.get('/api/notifications');
    return response.data;
  },
};

export default api;