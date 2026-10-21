import { request } from "./client";

export interface SiteConfigItem {
  id: number;
  key: string;
  value: string;
  description: string;
}

export function getSiteConfig() {
  // Transitional path: keep the legacy write routes at /api/site-config free
  // until site-config management moves to the local admin API.
  return request<Record<string, unknown>>("/api/site-config/public");
}

export function getSiteConfigByKey(key: string) {
  // The legacy endpoint returns the parsed value, not a SiteConfigItem.
  return request<unknown>(`/api/site-config/${key}`);
}
