// API client for Hodl.fun backend

import axios, { AxiosInstance, AxiosError } from 'axios';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Return the data directly
    return response.data;
  },
  (error: AxiosError) => {
    // Handle errors
    if (error.response) {
      // Server responded with error
      const errorData = error.response.data as { error?: string } | undefined;
      throw new Error(errorData?.error || 'An error occurred');
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server');
    } else {
      // Something else happened
      throw new Error(error.message || 'Request failed');
    }
  }
);

export default apiClient;
