import { getDb } from "@/server/db/client";
import { createProjectsService } from "./service";

export function getProjectsService() {
  return createProjectsService(getDb());
}
