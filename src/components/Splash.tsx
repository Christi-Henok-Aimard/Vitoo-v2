import { useEffect } from 'react';

/** Fond sombre animé (blobs rose / bleu / cyan) réutilisé par le splash et l'auth. */
export function GlassBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-backdrop ${className}`} aria-hidden="true">
      <span className="glass-blob blob-rose" />
      <span className="glass-blob blob-blue" />
      <span className="glass-blob blob-cyan" />
    </div>
  );
}

/** Écran de démarrage affiché une seule fois au montage de l'application. */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timer = window.setTimeout(onDone, reduced ? 700 : 1800);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="splash" role="status" aria-live="polite">
      <GlassBackdrop />
      <div className="splash-card glass">
        <div className="splash-logo">V</div>
        <div className="splash-brand">VITOO</div>
        <p className="splash-tagline">Tous vos trajets interurbains, au même endroit.</p>
        <div className="splash-progress">
          <span />
        </div>
      </div>
    </div>
  );
}
