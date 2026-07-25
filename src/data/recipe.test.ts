import { describe, expect, it } from "vitest";
import {
  featuredRecipe,
  getRecipeById,
  getRecipeStep,
  getRelevantSafetyNotes,
  getSuggestedTimers,
  getVisualCheckpoint,
  recipes
} from "./recipe";

const recipeIds = [
  "steak-au-poivre",
  "red-wine-braised-short-ribs",
  "french-omelette",
  "roast-chicken",
  "pasta-carbonara"
];

const steakImages = [
  "/recipe-steps/01-pat-dry-1200.jpg",
  "/recipe-steps/02-season-1200.jpg",
  "/recipe-steps/03-preheat-skillet-1200.jpg",
  "/recipe-steps/04-sear-first-side-1200.jpg",
  "/recipe-steps/05-flip-baste-1200.jpg",
  "/recipe-steps/06-check-rest-1200.jpg",
  "/recipe-steps/07-saute-shallot-1200.jpg",
  "/recipe-steps/08-deglaze-1200.jpg",
  "/recipe-steps/09-stock-cream-1200.jpg",
  "/recipe-steps/10-reduce-sauce-1200.jpg",
  "/recipe-steps/11-slice-plate-1200.jpg"
];

describe("recipe library data", () => {
  it("contains the five requested recipes in editorial order", () => {
    expect(recipes.map((recipe) => recipe.id)).toEqual(recipeIds);
    expect(recipes.map((recipe) => recipe.steps.length)).toEqual([11, 10, 9, 9, 10]);
  });

  it("features Steak au Poivre and only Steak au Poivre", () => {
    expect(featuredRecipe.id).toBe("steak-au-poivre");
    expect(recipes.filter((recipe) => recipe.isFeatured).map((recipe) => recipe.id)).toEqual([
      "steak-au-poivre"
    ]);
  });

  it("keeps every recipe step sequence contiguous", () => {
    for (const recipe of recipes) {
      expect(recipe.steps.map((step) => step.number)).toEqual(
        Array.from({ length: recipe.steps.length }, (_, index) => index + 1)
      );
    }
  });

  it("keeps timer and checkpoint references within their recipe", () => {
    for (const recipe of recipes) {
      for (const timer of recipe.suggestedTimers) {
        expect(timer.stepNumber).toBeGreaterThanOrEqual(1);
        expect(timer.stepNumber).toBeLessThanOrEqual(recipe.steps.length);
        expect(timer.durationSeconds).toBeGreaterThan(0);
      }

      for (const checkpoint of recipe.visualCheckpoints) {
        expect(checkpoint.stepNumber).toBeGreaterThanOrEqual(1);
        expect(checkpoint.stepNumber).toBeLessThanOrEqual(recipe.steps.length);
      }
    }
  });

  it("preserves every Steak au Poivre step image", () => {
    expect(featuredRecipe.steps.map((step) => step.image)).toEqual(steakImages);
    expect(featuredRecipe.steps.every((step) => (step.imageAlt?.length ?? 0) > 24)).toBe(true);
  });

  it("requires a thermometer reading before confirming roast chicken doneness", () => {
    const chicken = getRecipeById("roast-chicken");
    expect(chicken).toBeDefined();

    const temperatureStep = getRecipeStep(chicken!, 7);
    expect(`${temperatureStep.instruction} ${temperatureStep.detail}`).toContain("165°F");
    expect(`${temperatureStep.instruction} ${temperatureStep.detail}`).toContain(
      "without touching bone"
    );
    expect(getRelevantSafetyNotes(chicken!, 7).map((note) => note.text).join(" ")).toMatch(
      /thermometer reading.*165°F/
    );
    expect(getVisualCheckpoint(chicken!, 7)?.requiresMeasurement).toBe(true);
  });

  it("keeps carbonara off direct heat before the eggs are added", () => {
    const carbonara = getRecipeById("pasta-carbonara");
    expect(carbonara).toBeDefined();

    expect(getRecipeStep(carbonara!, 6).instruction).toMatch(
      /pasta to the guanciale.*remove the pan from direct heat/i
    );
    expect(`${getRecipeStep(carbonara!, 7).detail} ${getRecipeStep(carbonara!, 7).safety}`).toMatch(
      /keep the pan off direct heat/i
    );
  });

  it("clamps navigation to the selected recipe rather than the featured recipe", () => {
    const omelette = getRecipeById("french-omelette");
    const shortRibs = getRecipeById("red-wine-braised-short-ribs");
    expect(omelette).toBeDefined();
    expect(shortRibs).toBeDefined();

    expect(getRecipeStep(omelette!, 0).number).toBe(1);
    expect(getRecipeStep(omelette!, 99).number).toBe(9);
    expect(getRecipeStep(shortRibs!, 99).number).toBe(10);
  });

  it("returns helpers scoped to the current recipe step", () => {
    const shortRibs = getRecipeById("red-wine-braised-short-ribs");
    expect(shortRibs).toBeDefined();

    expect(getSuggestedTimers(shortRibs!, 6).map((timer) => timer.label)).toEqual([
      "Wine reduction check"
    ]);
    expect(getVisualCheckpoint(shortRibs!, 6)?.question).toBe(
      "Has the wine reduced enough?"
    );
  });
});
