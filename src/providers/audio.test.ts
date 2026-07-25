import { describe, expect, it } from "vitest";
import { downsampleToPcm16 } from "./audio";

describe("microphone PCM conversion", () => {
  it("downsamples browser audio to 16 kHz signed PCM", () => {
    const input = new Float32Array(4800).fill(0.5);
    const output = downsampleToPcm16(input, 48000, 16000);

    expect(output).toHaveLength(1600);
    expect(output[0]).toBeGreaterThan(16000);
    expect(output[0]).toBeLessThan(16500);
  });

  it("clamps out-of-range samples", () => {
    const output = downsampleToPcm16(new Float32Array([2, -2]), 16000, 16000);
    expect(output[0]).toBe(32767);
    expect(output[1]).toBe(-32768);
  });
});
