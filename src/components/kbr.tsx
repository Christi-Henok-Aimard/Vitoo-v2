import type { CSSProperties, ReactNode, Ref } from 'react';

/** Props acceptées par les éléments KBR-UI (attributs en kebab-case). */
interface KbrElementProps {
  [attribute: string]: unknown;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'toast-message': KbrElementProps;
      'copy-button': KbrElementProps;
      'tear-ticket': KbrElementProps;
      'tear-ticket-horizontal': KbrElementProps;
      'status-pill': KbrElementProps;
      'skeleton-list': KbrElementProps;
      'accordion-list': KbrElementProps;
      'segmented-control': KbrElementProps;
      'select-menu': KbrElementProps;
    }
  }
}

/** Les composants KBR attendent `appearance="light" | "dark"`. */
export function kbrAppearance(theme: 'light' | 'dark'): 'light' | 'dark' {
  return theme === 'dark' ? 'dark' : 'light';
}

/** Handle minimal pour piloter un composant KBR via ses méthodes exposées. */
export interface KbrHandle extends HTMLElement {
  show?: (message?: string, options?: { undo?: () => void }) => void;
  hide?: () => void;
  done?: () => void;
  fail?: () => void;
  reset?: () => void;
  start?: (remaining?: number) => void;
  select?: (value: string) => void;
}
