import { getDb } from "@/server/db/client";
import { createCategoriesService } from "./service";

export function getCategoriesService() {
  return createCategoriesService(getDb());
}
