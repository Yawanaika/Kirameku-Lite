import { getDb } from "@/server/db/client";
import { createPostsService } from "./service";

export function getPostsService() {
  return createPostsService(getDb());
}
