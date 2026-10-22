import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditActor {
  id: number;
  username: string;
}

export interface RequestAuditContext {
  actor?: AuditActor;
}

const storage = new AsyncLocalStorage<RequestAuditContext>();

/**
 * Run a Route Handler inside a mutable request context. `requireAdmin()` fills
 * in the actor, and `handle()` reads it back after the handler succeeds.
 */
export function runWithAuditContext<T>(
  context: RequestAuditContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

/**
 * Register the authenticated admin for the current request. Called outside an
 * audited request (for example while rendering an admin page) this is a no-op.
 */
export function setAuditActor(actor: AuditActor): void {
  const context = storage.getStore();
  if (context) context.actor = actor;
}
