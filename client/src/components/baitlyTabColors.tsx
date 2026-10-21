import type { CSSProperties, ReactNode } from 'react';
import { sizedIcon } from '../config/navigationIcons';
import './baitly-tab-colors.css';

/** Ordre de déclaration, avant filtrage des permissions : une teinte stable par onglet. */
export function baitlyTabColor(index: number): string {
  return `var(--bui-tab-${((index % 12) + 12) % 12})`;
}

export function baitlyTabStyle(color: string): CSSProperties {
  return { color, '--bui-tab-color': color } as CSSProperties;
}

export function BaitlyTabIcon({ icon, color, size = 16 }: {
  icon?: ReactNode;
  color: string;
  size?: number;
}) {
  return <span aria-hidden className="bui-tab-icon" style={baitlyTabStyle(color)}>
    {icon ? sizedIcon(icon, size, 1.75) : <span className="bui-tab-dot" />}
  </span>;
}
