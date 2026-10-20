import { env } from "@/server/env";
import { errors } from "./errors";

/** Reject writes while the site is in read-only cutover/maintenance mode. */
export function assertWritable(): void {
  if (env.SITE_READ_ONLY) throw errors.readOnly();
}
