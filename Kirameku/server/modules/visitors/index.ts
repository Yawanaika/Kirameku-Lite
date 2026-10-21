import { getDb } from "@/server/db/client";
import { createVisitorsService } from "./service";

export function getVisitorsService() {
  return createVisitorsService(getDb());
}
