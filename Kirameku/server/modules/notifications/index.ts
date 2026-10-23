import { getDb } from "@/server/db/client";
import { createNotificationsService } from "./service";

export function getNotificationsService() {
  return createNotificationsService(getDb());
}

export type { NotificationsService } from "./service";
