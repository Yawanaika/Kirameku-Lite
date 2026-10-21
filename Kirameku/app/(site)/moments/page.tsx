import { getChattersService } from "@/server/modules/chatters";
import MomentsClient from "./MomentsClient";

export const dynamic = "force-dynamic";

export default async function MomentsPage({
  searchParams,
}: {
  searchParams: Promise<{ onlyView?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawOnlyView =
    typeof params.onlyView === "string" ? params.onlyView : null;
  const parsedOnlyView = rawOnlyView ? Number.parseInt(rawOnlyView, 10) : NaN;
  const initialOnlyView =
    Number.isInteger(parsedOnlyView) && parsedOnlyView > 0
      ? String(parsedOnlyView)
      : null;

  const chatters = await getChattersService().list({
    status: "published",
    page: 1,
    size: 50,
  });

  return (
    <MomentsClient
      initialChatters={chatters}
      initialOnlyView={initialOnlyView}
    />
  );
}
