import { describe, expect, it } from "vitest";
import { parseSrt, serializeSrt, cuesAtTime, parseVtt } from "../src/text/subtitles.js";
import { secondsToTicks } from "../src/util/time.js";

describe("subtitles", () => {
  it("round-trips SRT and queries active cues", () => {
    const src = `1
00:00:01,000 --> 00:00:03,000
Hello

2
00:00:04,000 --> 00:00:05,500
World
`;
    const cues = parseSrt(src);
    expect(cues).toHaveLength(2);
    const out = serializeSrt(cues);
    expect(parseSrt(out)).toHaveLength(2);
    expect(cuesAtTime(cues, secondsToTicks(2))).toEqual(["Hello"]);
  });

  it("parses VTT", () => {
    const cues = parseVtt(`WEBVTT

00:00:00.000 --> 00:00:01.000
One
`);
    expect(cues[0]?.text).toBe("One");
  });
});
