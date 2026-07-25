import { describe, expect, it } from "vitest";
import { getRecipeById, type Recipe } from "../data/recipe";
import { buildRecipeContext, isRecipeContext } from "./recipeContext";
import { BASE_SYSTEM_INSTRUCTION, formatRecipeContext } from "./systemInstruction";

function requireRecipe(id: string): Recipe {
  const recipe = getRecipeById(id);
  if (!recipe) throw new Error(`Missing test recipe: ${id}`);
  return recipe;
}

describe("selected recipe context", () => {
  it("builds a complete, recipe-specific Carbonara context", () => {
    const carbonara = requireRecipe("pasta-carbonara");
    const context = buildRecipeContext({
      recipe: carbonara,
      currentStep: 7,
      completedSteps: [6, 1, 1, 0, 11, 2.5, 10],
      activeTimers: [
        { label: "Pan cooling", remainingSeconds: 12 },
        { label: "Pasta", remainingSeconds: 95 }
      ]
    });

    expect(context).toMatchObject({
      recipeId: "pasta-carbonara",
      recipeTitle: "Pasta Carbonara",
      recipeDescription:
        "Spaghetti coated with eggs, Pecorino Romano, black pepper, and crisp guanciale.",
      recipeTechnique: "Emulsification",
      currentStep: 7,
      totalSteps: 10,
      currentInstruction: "Add the egg and cheese mixture.",
      completedSteps: [1, 6, 10],
      activeTimers: [
        { label: "Pan cooling", remainingSeconds: 12 },
        { label: "Pasta", remainingSeconds: 95 }
      ]
    });
    expect(context.currentDetail).toMatch(/off direct heat/i);
    expect(context.recipeSteps).toHaveLength(10);
    expect(context.recipeSteps.map((step) => step.stepNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    ]);
    expect(context.recipeSteps[0]).toMatchObject({
      stepNumber: 1,
      instruction: carbonara.steps[0].instruction,
      detail: carbonara.steps[0].detail
    });
    expect(context.relevantSafetyNotes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/pan must remain off direct heat/i),
        expect.stringMatching(/pasteurized eggs/i)
      ])
    );
    expect(context.suggestedTimers).toEqual([
      expect.objectContaining({
        label: "Hot-pan settling check",
        durationSeconds: 20
      })
    ]);
    expect(context.visualCheckpoint).toMatchObject({
      question: "Is the pan too hot for the eggs?",
      requiresMeasurement: undefined
    });
    const formatted = formatRecipeContext(context);
    expect(formatted).toContain("Product: Mise");
    expect(formatted).toContain("Full ordered recipe steps:");
    expect(formatted).toContain(`1. ${carbonara.steps[0].title}:`);
    expect(formatted).toContain(`10. ${carbonara.steps[9].title}:`);
    expect(formatted).not.toContain("Steak au Poivre");
  });

  it("clamps the step to the selected recipe and carries measurement safety", () => {
    const chicken = requireRecipe("roast-chicken");
    const context = buildRecipeContext({
      recipe: chicken,
      currentStep: 99,
      completedSteps: [],
      activeTimers: []
    });

    expect(context.currentStep).toBe(9);
    expect(context.totalSteps).toBe(9);

    const temperatureContext = buildRecipeContext({
      recipe: chicken,
      currentStep: 7,
      completedSteps: [1, 2, 3, 4, 5, 6],
      activeTimers: [{ label: "Roast", remainingSeconds: 420 }]
    });
    const formatted = formatRecipeContext(temperatureContext);

    expect(temperatureContext.visualCheckpoint?.requiresMeasurement).toBe(true);
    expect(formatted).toContain("Recipe: Roast Chicken");
    expect(formatted).toContain("Current step: 7 of 9");
    expect(formatted).toMatch(/requires a measurement; appearance alone is insufficient/i);
    expect(formatted).toMatch(/thermometer reading/i);
    expect(formatted).toContain("Roast: 420s");
  });

  it("rejects empty recipes and malformed provider contexts", () => {
    expect(() =>
      buildRecipeContext({
        recipe: {
          id: "empty",
          title: "Empty",
          steps: []
        },
        currentStep: 1,
        completedSteps: [],
        activeTimers: []
      })
    ).toThrow(/must contain at least one step/i);

    const valid = buildRecipeContext({
      recipe: requireRecipe("french-omelette"),
      currentStep: 1,
      completedSteps: [],
      activeTimers: []
    });

    expect(isRecipeContext(valid)).toBe(true);
    expect(
      isRecipeContext({
        ...valid,
        suggestedTimers: [{ label: "Broken", durationSeconds: "ten" }]
      })
    ).toBe(false);
    expect(
      isRecipeContext({
        ...valid,
        activeTimers: [{ label: "Broken", remainingSeconds: Number.NaN }]
      })
    ).toBe(false);
    expect(
      isRecipeContext({
        ...valid,
        recipeSteps: valid.recipeSteps.slice().reverse()
      })
    ).toBe(false);
  });

  it("keeps the base instruction recipe-agnostic", () => {
    expect(BASE_SYSTEM_INSTRUCTION).toContain("selected recipe");
    expect(BASE_SYSTEM_INSTRUCTION).not.toMatch(
      /Steak au Poivre|French Omelette|Roast Chicken|Pasta Carbonara|Short Ribs/
    );
  });
});
