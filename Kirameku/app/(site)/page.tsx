import { getSiteStatsService } from "@/server/modules/site-stats";
import HomeClient from "./HomeClient";

export const revalidate = 60;

async function fetchProfileData() {
  try {
    return await getSiteStatsService().get();
  } catch (error) {
    console.error("Failed to load homepage stats", error);
    return { postCount: 0, chatterCount: 0, photoCount: 0 };
  }
}

export default async function Home() {
  const { postCount, chatterCount, photoCount } = await fetchProfileData();

  return (
    <HomeClient
      postCount={postCount}
      chatterCount={chatterCount}
      photoCount={photoCount}
    />
  );
}
