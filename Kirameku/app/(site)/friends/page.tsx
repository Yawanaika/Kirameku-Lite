import type { Metadata } from "next";
import { getFriendLinksService } from "@/server/modules/friend-links";
import { siteConfig } from "@/siteConfig";
import FriendsClient from "./FriendsClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `友链 · ${siteConfig.title}`,
  description: "漂流瓶里的朋友们",
};

export default async function FriendsPage() {
  const friends = await getFriendLinksService()
    .listApproved()
    .catch((error) => {
      console.error("Failed to load friend links", error);
      return [];
    });

  return <FriendsClient friends={friends} />;
}
