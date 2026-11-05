import { getDb } from "@/server/db/client";
import { createSearchService } from "./service";

export function getSearchService() {
  return createSearchService(getDb());
}
