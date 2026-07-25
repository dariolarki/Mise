import { ArrowDownRight } from "lucide-react";

interface LandingScreenProps {
  onStart(): void;
}

export function LandingScreen({ onStart }: LandingScreenProps) {
  return (
    <main className="landing">
      <div className="landing__rule" aria-hidden="true" />
      <section className="landing__composition">
        <h1 className="landing__brand">Mise</h1>

        <div className="landing__recipe">
          <div className="landing__title-row">
            <h2>Steak au Poivre</h2>
            <span className="landing__folio">001</span>
          </div>
          <div className="landing__meta">
            <span>11 steps</span>
            <span>35 min</span>
          </div>
          <p>A live sous chef for the whole cook.</p>
          <button className="primary-action" type="button" onClick={onStart}>
            <span>Start cooking</span>
            <ArrowDownRight aria-hidden="true" />
          </button>
        </div>

        <div className="landing__ingredients" aria-label="Featured ingredients">
          <span>Peppercorn</span>
          <i>·</i>
          <span>Cognac</span>
          <i>·</i>
          <span>Cream</span>
        </div>
      </section>
      <footer className="landing__footer">
        <span>Real-time visual AI sous chef</span>
        <span>Google Gemini</span>
      </footer>
    </main>
  );
}
