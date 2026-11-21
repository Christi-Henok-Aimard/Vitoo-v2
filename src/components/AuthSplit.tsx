import type { ReactNode } from 'react';

interface SplitPanel {
  title: string;
  text: string;
  buttonLabel: string;
  onButton: () => void;
}

interface AuthSplitProps {
  /** true = formulaire d'inscription visible à droite. */
  active: boolean;
  login: ReactNode;
  register: ReactNode;
  /** Panneau affiché à gauche quand l'inscription est active. */
  leftPanel: SplitPanel;
  /** Panneau affiché à droite quand la connexion est active. */
  rightPanel: SplitPanel;
  dark?: boolean;
}

/**
 * Carton d'authentification en deux panneaux avec glissement animé,
 * inspiré de https://github.com/BOSS0exe/Sign-in-and-Sign-up-page
 * (créé par badr aouragh / boss.exe).
 */
export function AuthSplit({ active, login, register, leftPanel, rightPanel, dark }: AuthSplitProps) {
  return (
    <div className="auth-split-shell">
      <div className={`auth-split${active ? ' active' : ''}${dark ? ' is-dark' : ''}`}>
        <div className="split-form split-sign-in">
          <div className="split-form-inner">{login}</div>
        </div>
        <div className="split-form split-sign-up">
          <div className="split-form-inner">{register}</div>
        </div>
        <div className="split-toggle">
          <div className="split-toggle-inner">
            <div className="split-panel split-panel-left">
              <h2>{leftPanel.title}</h2>
              <p>{leftPanel.text}</p>
              <button type="button" className="split-ghost-btn" onClick={leftPanel.onButton}>{leftPanel.buttonLabel}</button>
            </div>
            <div className="split-panel split-panel-right">
              <h2>{rightPanel.title}</h2>
              <p>{rightPanel.text}</p>
              <button type="button" className="split-ghost-btn" onClick={rightPanel.onButton}>{rightPanel.buttonLabel}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
