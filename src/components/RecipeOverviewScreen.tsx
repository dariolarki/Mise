import { ArrowLeft, ArrowRight } from "lucide-react";
import { recipes, type Recipe } from "../data/recipe";

interface RecipeOverviewScreenProps {
  recipe: Recipe;
  onBack(): void;
  onStart(): void;
}

export function RecipeOverviewScreen({
  recipe,
  onBack,
  onStart
}: RecipeOverviewScreenProps) {
  const folio = recipes.indexOf(recipe) + 1;

  return (
    <main className="overview">
      <header className="overview__header">
        <span className="overview__brand">Mise</span>
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          <span>Recipe library</span>
        </button>
        <span className="overview__folio">
          {String(folio).padStart(2, "0")} / {String(recipes.length).padStart(2, "0")}
        </span>
      </header>

      <section className="overview__hero">
        <h1>{recipe.title}</h1>
        <p>{recipe.description}</p>
        <dl className="overview__meta">
          <div>
            <dt>Time</dt>
            <dd>{recipe.totalTime}</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd>{recipe.difficulty}</dd>
          </div>
          <div>
            <dt>Technique</dt>
            <dd>{recipe.technique}</dd>
          </div>
        </dl>
        <button className="overview__start" type="button" onClick={onStart}>
          <span>Start guided cooking</span>
          <ArrowRight aria-hidden="true" />
        </button>
      </section>

      <section className="overview__contents">
        <section className="overview__ingredients">
          <h2>Ingredients</h2>
          <ul>
            {recipe.ingredients.map((ingredient) => (
              <li key={`${ingredient.amount}-${ingredient.name}`}>
                <span>{ingredient.name}</span>
                <small>
                  {ingredient.amount}
                  {ingredient.preparation ? ` · ${ingredient.preparation}` : ""}
                </small>
              </li>
            ))}
          </ul>
        </section>

        <section className="overview__method">
          <h2>Method</h2>
          <ol>
            {recipe.steps.map((step) => (
              <li key={step.number}>
                <span>{String(step.number).padStart(2, "0")}</span>
                <strong>{step.title}</strong>
              </li>
            ))}
          </ol>

          <section className="overview__checkpoints">
            <h2>Useful checkpoints</h2>
            <ul>
              {recipe.visualCheckpoints.map((checkpoint) => (
                <li key={`${checkpoint.stepNumber}-${checkpoint.question}`}>
                  {checkpoint.question}
                </li>
              ))}
            </ul>
          </section>
        </section>
      </section>
    </main>
  );
}
