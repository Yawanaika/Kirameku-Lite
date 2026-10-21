import { getDb } from "@/server/db/client";
import { createSiteStatsService } from "./service";

export function getSiteStatsService() {
  return createSiteStatsService(getDb());
}
