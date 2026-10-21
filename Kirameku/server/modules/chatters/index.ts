import { getDb } from "@/server/db/client";
import { createChattersService } from "./service";

export function getChattersService() {
  return createChattersService(getDb());
}
