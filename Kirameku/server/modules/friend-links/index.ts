import { getDb } from "@/server/db/client";
import { createFriendLinksService } from "./service";

export function getFriendLinksService() {
  return createFriendLinksService(getDb());
}
