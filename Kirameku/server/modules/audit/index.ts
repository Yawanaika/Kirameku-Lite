import { getDb } from "@/server/db/client";
import { createAuditService } from "./service";

export function getAuditService() {
  return createAuditService(getDb());
}
