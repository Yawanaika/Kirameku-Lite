import { request } from "./client";

export interface SiteConfigItem {
  id: number;
  key: string;
  value: string;
  description: string;
}

export function getSiteConfig() {
  return request<Record<string, unknown>>("/api/site-config");
}

export function getSiteConfigByKey(key: string) {
  // Public config values are returned parsed, not as SiteConfigItem rows.
  return request<unknown>(`/api/site-config/${encodeURIComponent(key)}`);
}
