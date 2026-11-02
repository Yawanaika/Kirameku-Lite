import type { Metadata } from "next";
import { getFriendLinksService } from "@/server/modules/friend-links";
import { loadSiteSettings } from "@/server/modules/site-settings";
import FriendsClient from "./FriendsClient";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await loadSiteSettings();

  return {
    title: `友链 · ${profile.siteTitle}`,
    description: "漂流瓶里的朋友们",
  };
}

export default async function FriendsPage() {
  const friends = await getFriendLinksService()
    .listApproved()
    .catch((error) => {
      console.error("Failed to load friend links", error);
      return [];
    });

  return <FriendsClient friends={friends} />;
}
