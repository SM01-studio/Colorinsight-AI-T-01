/**
 * ColorInsight API Service
 * All API calls go through backend for security
 */

import { ColorScheme, Requirement, SearchResult } from "../types";

// API Base URL - uses backend proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.siliang.cfd/api/colorinsight';
const MAIN_PORTAL = 'https://siliang.cfd';

// Request timeout (5 minutes for AI operations)
const REQUEST_TIMEOUT = 5 * 60 * 1000;

/**
 * Get authentication token
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token') ||
         new URLSearchParams(window.location.search).get('auth_token');
};

/**
 * Make authenticated API request with timeout
 */
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (response.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = `${MAIN_PORTAL}/index.html?from=colorinsight`;
      throw new Error('Authentication expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Verify authentication token
 */
export const verifyAuth = async (): Promise<{ valid: boolean; user?: any }> => {
  try {
    const result = await apiRequest<{ valid: boolean; user: any }>('/verify');
    return result;
  } catch (error) {
    return { valid: false };
  }
};

/**
 * Extract color requirements from PDF text
 */
export const extractRequirements = async (
  pdfText: string
): Promise<{ customerName: string; requirements: Requirement[] }> => {
  return apiRequest('/extract-requirements', {
    method: 'POST',
    body: JSON.stringify({ pdfText }),
  });
};

/**
 * Perform market research using Google Search
 */
export const performMarketSearch = async (
  requirements: Requirement[]
): Promise<SearchResult> => {
  return apiRequest('/market-search', {
    method: 'POST',
    body: JSON.stringify({ requirements }),
  });
};

/**
 * Generate and score color schemes
 */
export const generateAndScoreSchemes = async (
  requirements: Requirement[],
  searchData: SearchResult
): Promise<ColorScheme[]> => {
  return apiRequest('/generate-schemes', {
    method: 'POST',
    body: JSON.stringify({ requirements, searchData }),
  });
};

/**
 * Generate visualization image
 */
export const generateVisualizationImage = async (
  scheme: ColorScheme,
  requirements: Requirement[]
): Promise<string> => {
  const result = await apiRequest<{ image: string }>('/generate-image', {
    method: 'POST',
    body: JSON.stringify({ scheme, requirements }),
  });
  return result.image;
};
