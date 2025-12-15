import { api } from './api';

export interface SearchEmail {
  id: string;
  sender: string;
  subject: string;
  snippet?: string;
  score: number;
  matchedFields: string[];
}

export interface SearchResponse {
  total: number;
  results: SearchEmail[];
}

/**
 * Call fuzzy search API endpoint
 */
export const searchEmails = async (
  query: string,
  options: {
    fields?: string[];
    limit?: number;
    offset?: number;
  } = {},
): Promise<SearchResponse> => {
  try {
    const { fields = ['subject', 'sender'], limit = 20, offset = 0 } = options;

    const response = await api.get<SearchResponse>('/api/search', {
      params: {
        q: query,
        fields: fields.join(','),
        limit,
        offset,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Search failed:', error.response?.data || error.message);
    throw error;
  }
};
