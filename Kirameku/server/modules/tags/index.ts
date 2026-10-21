import { getDb } from "@/server/db/client";
import { createTagsService } from "./service";

export function getTagsService() {
  return createTagsService(getDb());
}
