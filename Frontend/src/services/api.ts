import { KeyStatistics } from '../types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const fetchKeyStatistics = async (symbol: string): Promise<KeyStatistics> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_BASE_URL}/quote?symbol=${symbol}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to fetch key statistics');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching key statistics:', error);
    throw error;
  }
};
