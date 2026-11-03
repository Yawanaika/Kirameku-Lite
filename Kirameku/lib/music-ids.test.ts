import { describe, expect, it } from "vitest";
import { isPlaylistId, splitMusicIds } from "./music-ids";

describe("splitMusicIds", () => {
  it("splits on newlines so the textarea can hold many ids", () => {
    expect(splitMusicIds("1824045033\n1974443814\n33737079")).toEqual([
      "1824045033",
      "1974443814",
      "33737079",
    ]);
  });

  it("accepts commas, semicolons and spaces as separators", () => {
    expect(splitMusicIds("1,2，3;4；5 6")).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("drops duplicates and empty tokens", () => {
    expect(splitMusicIds("1\n\n1\n  \n2")).toEqual(["1", "2"]);
  });

  it("keeps non numeric tokens so validation can report them", () => {
    expect(splitMusicIds("1\nabc")).toEqual(["1", "abc"]);
  });

  it("truncates to the configured maximum", () => {
    expect(splitMusicIds("1 2 3 4", 2)).toEqual(["1", "2"]);
  });
});

describe("isPlaylistId", () => {
  it("accepts empty and digit-only values", () => {
    expect(isPlaylistId("")).toBe(true);
    expect(isPlaylistId("628549602")).toBe(true);
    expect(isPlaylistId(" 628549602 ")).toBe(true);
  });

  it("rejects anything else so saving fails loudly", () => {
    expect(isPlaylistId("https://music.163.com/#/playlist?id=628549602")).toBe(false);
    expect(isPlaylistId("abc")).toBe(false);
  });
});
