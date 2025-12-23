import { api } from './api';

export interface SearchResult {
  id: string; // Changed from _id to match backend response
  sender: string;
  subject: string;
  snippet: string;
  score: number;
  matchedFields?: string[];
}

export interface SearchResponse {
  success: boolean;
  data: {
    total: number;
    results: SearchResult[];
  };
}

export interface SuggestionsResponse {
  success: boolean;
  data: {
    senders: string[];
    subjects: string[];
  };
}

/**
 * 🔍 Fuzzy search emails qua API backend
 * Hỗ trợ typo tolerance + partial match + lọc theo thư mục
 */
export async function searchEmails(
  query: string,
  options?: {
    fields?: string[];
    limit?: number;
    offset?: number;
    label?: string; // Optional: INBOX, SENT, DRAFT, UNREAD, STARRED, etc.
  },
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.append('q', query);

  if (options?.fields?.length) {
    params.append('fields', options.fields.join(','));
  }

  if (options?.limit) {
    params.append('limit', String(options.limit));
  }

  if (options?.offset) {
    params.append('offset', String(options.offset));
  }

  // Add label filter if provided
  if (options?.label) {
    params.append('label', options.label);
  }

  const url = `/api/search?${params.toString()}`;
  console.log('[searchService] 📡 Calling:', url);

  try {
    const response = await api.get<SearchResponse>(url);
    console.log('[searchService] ✅ Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[searchService] ❌ Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
}

export async function semanticSearchEmails(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    label?: string;
  },
): Promise<SearchResponse> {
  const body: any = { q: query };
  if (options?.limit) body.limit = options.limit;
  if (options?.offset) body.offset = options.offset;
  if (options?.label) body.label = options.label;

  try {
    const response = await api.post<SearchResponse>('/api/search/semantic', body);
    return response.data;
  } catch (error: any) {
    console.error('[searchService] semanticSearch error:', error.response?.data || error.message || error);
    throw error;
  }
}

/**
 * 💡 Get auto-suggestions for type-ahead search
 * Returns sender names and subject keywords matching the prefix
 */
export async function getSearchSuggestions(
  prefix: string,
  options?: {
    label?: string;
    limit?: number;
  },
): Promise<SuggestionsResponse> {
  const params = new URLSearchParams();
  params.append('prefix', prefix);

  if (options?.label) {
    params.append('label', options.label);
  }

  if (options?.limit) {
    params.append('limit', String(options.limit));
  }

  const url = `/api/search/suggestions?${params.toString()}`;
  console.log('[searchService] 💡 Suggestions:', url);

  try {
    const response = await api.get<SuggestionsResponse>(url);
    console.log('[searchService] ✅ Suggestions response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[searchService] 💡 Suggestions error:', error.response?.data || error.message);
    // Return empty suggestions on error instead of throwing
    return { success: false, data: { senders: [], subjects: [] } };
  }
}
