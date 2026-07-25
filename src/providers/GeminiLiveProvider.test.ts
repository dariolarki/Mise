import { describe, expect, it } from "vitest";
import { MAX_TIMER_SECONDS } from "../constants";
import {
  buildFunctionDeclarations,
  FALLBACK_LIVE_MODEL
} from "./GeminiLiveProvider";

interface IntegerProperty {
  type: string;
  minimum: number;
  maximum: number;
}

function integerProperty(
  totalSteps: number,
  declarationName: string,
  propertyName: string
): IntegerProperty {
  const declaration = buildFunctionDeclarations(totalSteps).find(
    (candidate) => candidate.name === declarationName
  );
  const schema =
    declaration && "parametersJsonSchema" in declaration
      ? declaration.parametersJsonSchema
      : undefined;
  if (!schema) {
    throw new Error(`Missing declaration: ${declarationName}`);
  }

  const property = (schema.properties as Record<string, unknown>)[propertyName];
  if (
    !property ||
    typeof property !== "object" ||
    typeof (property as Partial<IntegerProperty>).type !== "string" ||
    typeof (property as Partial<IntegerProperty>).minimum !== "number" ||
    typeof (property as Partial<IntegerProperty>).maximum !== "number"
  ) {
    throw new Error(`Missing integer property: ${declarationName}.${propertyName}`);
  }
  return property as IntegerProperty;
}

describe("Gemini Live tool declarations", () => {
  it("uses the current native-audio Live model as its validated fallback", () => {
    expect(FALLBACK_LIVE_MODEL).toBe("gemini-3.1-flash-live-preview");
  });

  it.each([
    [9, 9],
    [10, 10],
    [11, 11],
    [0, 1],
    [Number.NaN, 1]
  ])("bounds recipe navigation for a %s-step context", (totalSteps, expectedMaximum) => {
    expect(integerProperty(totalSteps, "advance_step", "stepNumber")).toMatchObject({
      minimum: 1,
      maximum: expectedMaximum
    });
    expect(integerProperty(totalSteps, "set_current_step", "stepNumber")).toMatchObject({
      minimum: 1,
      maximum: expectedMaximum
    });
  });

  it("shares the application timer ceiling", () => {
    expect(integerProperty(10, "start_timer", "durationSeconds")).toMatchObject({
      minimum: 1,
      maximum: MAX_TIMER_SECONDS
    });
    expect(MAX_TIMER_SECONDS).toBeGreaterThanOrEqual(9_000);
  });
});
