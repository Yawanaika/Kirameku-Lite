import { z } from "zod";

export const visitorListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export interface VisitorListParams {
  page: number;
  size: number;
}

export interface VisitorGeo {
  country: string;
  region: string;
  city: string;
  district: string;
  org: string;
  asn: string;
  is_mobile: boolean;
  is_proxy: boolean;
  is_hosting: boolean;
}

export interface VisitorItem {
  id: number;
  ip: string;
  path: string;
  city: string;
  region: string;
  country: string;
  district: string;
  org: string;
  org_cn: string;
  asn: string;
  is_mobile: boolean;
  is_proxy: boolean;
  is_hosting: boolean;
  browser: string;
  os: string;
  device_type: string;
  created_at: string;
}
