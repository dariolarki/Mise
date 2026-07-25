import { describe, expect, it } from "vitest";
import {
  normalizeImageAssessment,
  redactSensitiveText,
  summarizeGeminiError
} from "./reliability.js";

describe("normalizeImageAssessment", () => {
  it("preserves the exact public contract for a visual-only checkpoint", () => {
    expect(
      normalizeImageAssessment(
        {
          assessment: "The crust is evenly browned.",
          nextAction: "Flip the steak now.",
          safetyNote: null
        },
        { isChicken: false, requiresMeasurement: false }
      )
    ).toEqual({
      assessment: "The crust is evenly browned.",
      nextAction: "Flip the steak now.",
      safetyNote: null
    });
  });

  it("enforces thermometer guidance for chicken", () => {
    expect(
      normalizeImageAssessment(
        {
          assessment: "The chicken looks fully cooked.",
          nextAction: "Serve it.",
          safetyNote: null
        },
        { isChicken: true, requiresMeasurement: true }
      )
    ).toEqual({
      assessment:
        "The photo can show surface color and browning, but it cannot confirm internal doneness.",
      nextAction:
        "Check the internal temperature in the thickest part of the thigh without touching bone, then use that reading to judge doneness.",
      safetyNote:
        "Do not serve chicken based on appearance alone; use a verified internal-temperature reading."
    });
  });

  it("adds a measurement disclaimer without discarding a safe visual observation", () => {
    expect(
      normalizeImageAssessment(
        {
          assessment: "The steak has an even mahogany crust.",
          nextAction: "Slice it.",
          safetyNote: null
        },
        { isChicken: false, requiresMeasurement: true }
      )
    ).toEqual({
      assessment:
        "The steak has an even mahogany crust. A photo cannot confirm internal doneness.",
      nextAction:
        "Check the internal temperature with a food thermometer at the thickest part, then use that reading to judge doneness.",
      safetyNote:
        "Appearance alone cannot confirm a safe internal temperature."
    });
  });

  it("rejects incomplete model output", () => {
    expect(() =>
      normalizeImageAssessment(
        { assessment: "Brown crust", safetyNote: null },
        { isChicken: false, requiresMeasurement: false }
      )
    ).toThrow("nextAction");
  });
});

describe("safe Gemini logging", () => {
  it("redacts permanent keys, ephemeral tokens, and token query parameters", () => {
    const sensitive =
      "AIza1234567890abcdefghijkl auth_tokens/session-secret?x=1 " +
      "https://example.test/live?access_token=temporary-secret " +
      "x-goog-api-key: another-secret";
    const redacted = redactSensitiveText(sensitive);

    expect(redacted).not.toContain("AIza1234567890abcdefghijkl");
    expect(redacted).not.toContain("session-secret");
    expect(redacted).not.toContain("temporary-secret");
    expect(redacted).not.toContain("another-secret");
  });

  it("summarizes an SDK-style error without retaining a key", () => {
    const error = Object.assign(
      new Error("Request failed with x-goog-api-key: super-secret"),
      { status: 429, code: "RESOURCE_EXHAUSTED" }
    );

    expect(summarizeGeminiError(error)).toEqual({
      name: "Error",
      message: "Request failed with x-goog-api-key=[redacted]",
      status: 429,
      code: "RESOURCE_EXHAUSTED"
    });
  });
});
