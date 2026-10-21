import { handle } from "@/server/http/handler";
import { requireGithubUser } from "@/server/modules/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const user = await requireGithubUser(request);
      return {
        id: user.id,
        login: user.login,
        avatar: user.avatar ?? "",
        bio: user.bio ?? "",
      };
    },
    { request },
  );
}
