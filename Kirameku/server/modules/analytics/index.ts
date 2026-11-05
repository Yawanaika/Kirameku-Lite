import { getDb } from "@/server/db/client";
import { createAnalyticsService } from "./service";

export { analyticsQuery } from "./contracts";
export type {
  AnalyticsBreakdown,
  AnalyticsBucket,
  AnalyticsOverview,
  AnalyticsTotals,
} from "./contracts";

export function getAnalyticsService() {
  return createAnalyticsService(getDb());
}
