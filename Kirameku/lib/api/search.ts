import { request, qs } from "./client";

export interface SearchHit {
  id: number;
  title: string;
  slug: string;
  description: string;
  snippet: string;
  category: string;
  published_at: string | null;
}

export interface SearchResult {
  query: string;
  total: number;
  hits: SearchHit[];
  fuzzy: boolean;
}

export function searchPosts(q: string, limit = 10) {
  return request<SearchResult>(`/api/search${qs({ q, limit })}`);
}
