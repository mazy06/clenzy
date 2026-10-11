import React, { useEffect, useId, useRef, useState } from 'react';
import { directionsLinks, type DirectionsTarget } from '../../utils/directions';
import type { GuideLabels } from './WelcomeBookView';

interface GuideDirectionsProps {
  target: DirectionsTarget;
  labels: GuideLabels;
  /** Aperçu de l'éditeur : bouton inerte. */
  interactive: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * « Itinéraire » du livret voyageur : le voyageur choisit son application GPS
 * (Plans, Google Maps, Waze) au lieu d'être envoyé d'office sur Google Maps.
 * Habillage du livret (variables `--ink`, `--card`… du thème voyageur).
 */
export function GuideDirections({ target, labels: L, interactive, className, style, children }: GuideDirectionsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const links = directionsLinks(target);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!links) return null;
  const apps: Array<{ href: string; label: string }> = [
    { href: links.appleMaps, label: L.appleMaps ?? 'Plans' },
    { href: links.googleMaps, label: 'Google Maps' },
    { href: links.waze, label: 'Waze' },
  ];

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        className={className}
        style={{ ...style, cursor: interactive ? 'pointer' : 'default' }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => interactive && setOpen((value) => !value)}
      >
        {children}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            top: 'calc(100% + 6px)',
            zIndex: 20,
            minWidth: 176,
            padding: 6,
            borderRadius: 14,
            background: 'var(--card)',
            border: '1px solid var(--line)',
            boxShadow: '0 12px 28px -12px rgba(0, 0, 0, 0.28)',
          }}
        >
          <div style={{ padding: '4px 8px 6px', fontSize: 11, color: 'var(--ink-soft, var(--ink))', opacity: 0.75 }}>
            {L.navigateWith ?? L.viewMap}
          </div>
          {apps.map((app) => (
            <a
              key={app.label}
              role="menuitem"
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{ display: 'block', padding: '9px 10px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
            >
              {app.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
