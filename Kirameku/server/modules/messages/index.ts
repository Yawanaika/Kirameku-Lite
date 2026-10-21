import { getDb } from "@/server/db/client";
import { createMessagesService } from "./service";

export function getMessagesService() {
  return createMessagesService(getDb());
}
