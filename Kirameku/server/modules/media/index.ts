import { getDb } from "@/server/db/client";
import { createMediaService } from "./service";

export { MEDIA_SORTS, mediaListQuery } from "./contracts";
export type {
  MediaAlbumRef,
  MediaAlbumStat,
  MediaItem,
  MediaListQuery,
  MediaOverview,
  MediaSort,
} from "./contracts";

export function getMediaService() {
  return createMediaService(getDb());
}
