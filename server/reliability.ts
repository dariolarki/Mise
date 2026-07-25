export interface ImageAssessmentContract {
  assessment: string;
  nextAction: string;
  safetyNote: string | null;
}

export interface ImageAssessmentPolicy {
  isChicken: boolean;
  requiresMeasurement: boolean;
}

const MAX_ASSESSMENT_LENGTH = 800;
const VISUAL_DONENESS_CLAIM =
  /\b(?:safe(?:\s+to\s+eat)?|done|fully\s+cooked|cooked\s+through|ready\s+to\s+(?:eat|serve))\b/i;
const SENSITIVE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bAIza[0-9A-Za-z_-]{15,}\b/g, "[redacted-api-key]"],
  [
    /\b(?:auth_tokens?|authTokens?)\/[^\s"'<>]+/gi,
    "[redacted-ephemeral-token]"
  ],
  [
    /([?&](?:access_token|api_key|key)=)[^&\s]+/gi,
    "$1[redacted]"
  ],
  [
    /\b(authorization|x-goog-api-key)\b\s*[:=]\s*(?:Token\s+|Bearer\s+)?[^\s,;]+/gi,
    "$1=[redacted]"
  ]
];

function requiredBriefString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Gemini returned an invalid ${field}.`);
  }
  return value.trim().slice(0, MAX_ASSESSMENT_LENGTH);
}

function optionalBriefString(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Gemini returned an invalid safetyNote.");
  }
  const cleanValue = value.trim();
  return cleanValue ? cleanValue.slice(0, MAX_ASSESSMENT_LENGTH) : null;
}

export function normalizeImageAssessment(
  value: unknown,
  policy: ImageAssessmentPolicy
): ImageAssessmentContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini returned an invalid image assessment.");
  }

  const candidate = value as Record<string, unknown>;
  let assessment = requiredBriefString(candidate.assessment, "assessment");
  let nextAction = requiredBriefString(candidate.nextAction, "nextAction");
  let safetyNote = optionalBriefString(candidate.safetyNote);

  if (policy.isChicken) {
    if (VISUAL_DONENESS_CLAIM.test(assessment)) {
      assessment =
        "The photo can show surface color and browning, but it cannot confirm internal doneness.";
    } else if (!/\bcannot confirm internal doneness\b/i.test(assessment)) {
      assessment =
        `${assessment} A photo cannot confirm internal doneness.`.slice(
          0,
          MAX_ASSESSMENT_LENGTH
        );
    }
    nextAction =
      "Check the internal temperature in the thickest part of the thigh without touching bone, then use that reading to judge doneness.";
    safetyNote =
      "Do not serve chicken based on appearance alone; use a verified internal-temperature reading.";
  } else if (policy.requiresMeasurement) {
    if (VISUAL_DONENESS_CLAIM.test(assessment)) {
      assessment =
        "The photo can show surface color and texture, but it cannot confirm internal doneness.";
    } else if (!/\bcannot confirm internal doneness\b/i.test(assessment)) {
      assessment =
        `${assessment} A photo cannot confirm internal doneness.`.slice(
          0,
          MAX_ASSESSMENT_LENGTH
        );
    }
    nextAction =
      "Check the internal temperature with a food thermometer at the thickest part, then use that reading to judge doneness.";
    safetyNote =
      safetyNote ??
      "Appearance alone cannot confirm a safe internal temperature.";
  }

  return { assessment, nextAction, safetyNote };
}

export function redactSensitiveText(value: string) {
  let redacted = value;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted.slice(0, 1_000);
}

export function summarizeGeminiError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: "No safe error details were available."
    };
  }

  const candidate = error as Error & {
    status?: unknown;
    code?: unknown;
  };
  const summary: {
    name: string;
    message: string;
    status?: number;
    code?: string | number;
  } = {
    name: redactSensitiveText(error.name || "Error"),
    message: redactSensitiveText(error.message || "No error message was provided.")
  };

  if (typeof candidate.status === "number" && Number.isFinite(candidate.status)) {
    summary.status = candidate.status;
  }
  if (
    typeof candidate.code === "number" ||
    typeof candidate.code === "string"
  ) {
    summary.code =
      typeof candidate.code === "string"
        ? redactSensitiveText(candidate.code)
        : candidate.code;
  }

  return summary;
}
