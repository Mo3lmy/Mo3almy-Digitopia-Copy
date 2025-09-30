// Base URL without /api/v1 - will be added by services
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_URL = `${API_BASE_URL}/api/v1`;

export const getApiUrl = (endpoint: string) => {
  // Remove leading /api/v1 if present to avoid duplication
  const cleanEndpoint = endpoint.replace(/^\/api\/v1\/?/, '');
  return `${API_URL}${cleanEndpoint.startsWith('/') ? '' : '/'}${cleanEndpoint}`;
};