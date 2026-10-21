import { getDb } from "@/server/db/client";
import { createCommentsService } from "./service";

export function getCommentsService() {
  return createCommentsService(getDb());
}
