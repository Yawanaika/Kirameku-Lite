import { getDb } from "@/server/db/client";
import { createBookmarksService } from "./service";

export function getBookmarksService() {
  return createBookmarksService(getDb());
}
