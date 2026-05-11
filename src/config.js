// API configuration - uses environment variables for production
// In development: defaults to localhost
// In production: set VITE_API_URL in Vercel environment variables

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_URL = `${API_BASE_URL}/api`;
