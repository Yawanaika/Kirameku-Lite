import { errors } from "./errors";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw errors.badRequest("请求体必须是合法 JSON");
  }
}
