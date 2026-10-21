import { getDb } from "@/server/db/client";
import { createSiteConfigService } from "./service";

export function getSiteConfigService() {
  return createSiteConfigService(getDb());
}
