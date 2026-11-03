import { SITE_SETTINGS_LIMITS } from "@/lib/site-settings";

/** 歌曲 ID 输入框允许的分隔符：换行、逗号（含中文全角）、分号、空格。 */
const SEPARATOR = /[\s,，;；]+/;

/**
 * 把后台「歌曲 ID 列表」里的整段文本拆成 ID 数组。
 *
 * 这里只做切分、去重与截断；非数字的片段会原样保留，
 * 交给调用方的校验去报错，免得用户敲到一半就被悄悄吞掉。
 */
export function splitMusicIds(
  text: string,
  max: number = SITE_SETTINGS_LIMITS.musicTrackIds,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const token of text.split(SEPARATOR)) {
    const id = token.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

/** 歌单 ID 在网易云里就是一串数字。 */
export function isPlaylistId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || /^\d{1,20}$/.test(trimmed);
}
