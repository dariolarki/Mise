import { ArrowRight } from "lucide-react";
import { recipes, type Recipe } from "../data/recipe";

interface RecipeLibraryScreenProps {
  onSelect(recipe: Recipe): void;
  onStart(recipe: Recipe): void;
}

function RecipeMeta({ recipe }: { recipe: Recipe }) {
  return (
    <dl className="recipe-meta">
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
  );
}

function StartRecipeAction({
  recipe,
  onStart
}: {
  recipe: Recipe;
  onStart(recipe: Recipe): void;
}) {
  return (
    <button
      className="recipe-start"
      type="button"
      onClick={() => onStart(recipe)}
      aria-label={`Start cooking ${recipe.title}`}
    >
      <span>Start cooking</span>
      <i aria-hidden="true" />
      <ArrowRight aria-hidden="true" />
    </button>
  );
}

export function RecipeLibraryScreen({
  onSelect,
  onStart
}: RecipeLibraryScreenProps) {
  const featuredRecipe = recipes.find((recipe) => recipe.isFeatured) ?? recipes[0];
  const indexRecipes = recipes.filter((recipe) => recipe.id !== featuredRecipe.id);

  return (
    <main className="library">
      <header className="library__header">
        <h1>Mise</h1>
        <p>
          Recipe library <i>·</i> <strong>{String(recipes.length).padStart(2, "0")}</strong>
        </p>
      </header>

      <section className="library-feature" aria-labelledby="featured-recipe-title">
        <div className="library-feature__folio">
          <strong>01</strong>
          <i aria-hidden="true" />
          <span>Featured</span>
        </div>

        <h2 id="featured-recipe-title">
          <button type="button" onClick={() => onSelect(featuredRecipe)}>
            {featuredRecipe.title}
          </button>
        </h2>
        <p className="library-feature__description">{featuredRecipe.description}</p>

        <div className="library-feature__footer">
          <RecipeMeta recipe={featuredRecipe} />
          <StartRecipeAction recipe={featuredRecipe} onStart={onStart} />
        </div>
      </section>

      <section className="recipe-index" aria-label="All recipes">
        {indexRecipes.map((recipe) => {
          const folio = recipes.indexOf(recipe) + 1;
          return (
            <article className="recipe-index__row" key={recipe.id}>
              <span className="recipe-index__folio">
                {String(folio).padStart(2, "0")}
              </span>
              <h2>
                <button type="button" onClick={() => onSelect(recipe)}>
                  {recipe.title}
                </button>
              </h2>
              <p>{recipe.description}</p>
              <RecipeMeta recipe={recipe} />
              <StartRecipeAction recipe={recipe} onStart={onStart} />
            </article>
          );
        })}
      </section>
    </main>
  );
}
