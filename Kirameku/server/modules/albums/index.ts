import { getDb } from "@/server/db/client";
import { createAlbumsService } from "./service";

export function getAlbumsService() {
  return createAlbumsService(getDb());
}
