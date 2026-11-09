import "server-only";
import { revalidatePosts } from "@/lib/revalidate";
import { getPostsService } from "@/server/modules/posts";

let timer: ReturnType<typeof setInterval> | null = null;

export function startPostScheduleRunner(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const changed = await getPostsService().runDuePostSchedules();
      if (changed > 0) revalidatePosts();
    } catch (error) {
      console.error("文章计划发布任务执行失败", error);
    }
  };
  void tick();
  timer = setInterval(() => void tick(), 30_000);
  timer.unref?.();
}
