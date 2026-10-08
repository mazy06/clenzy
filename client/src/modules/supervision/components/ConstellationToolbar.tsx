import type { ReactNode } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import '../supervision-surfaces.css';
import './constellation-toolbar.css';

interface ConstellationToolbarProps {
  agentsCount: number;
  actingCount: number;
  pendingCount: number;
  online: boolean;
  paused: boolean;
  compact?: boolean;
  children?: ReactNode;
}

/** Shared identity and activity bar for the planning and compact constellation. */
export function ConstellationToolbar({
  agentsCount, actingCount, pendingCount, online, paused, compact, children,
}: ConstellationToolbarProps) {
  const { t, currentLanguage } = useTranslation();
  const number = new Intl.NumberFormat(currentLanguage);
  const state = !online ? 'offline' : paused ? 'paused' : 'online';

  return (
    <header className="baitly-supervision-surface baitly-constellation-toolbar" data-compact={compact || undefined}>
      <div className="baitly-constellation-toolbar__identity">
        <div className="baitly-constellation-toolbar__heading">
          <h2>{t('supervision.board.title', "Constellation d’agents")}</h2>
          {pendingCount > 0 && (
            <span className="baitly-constellation-toolbar__pending">
              <b>{number.format(pendingCount)}</b>
              {t('supervision.board.toValidate', 'à valider')}
            </span>
          )}
        </div>
        <div className="baitly-constellation-toolbar__meta">
          <span><b>{number.format(agentsCount)}</b> {t('supervision.hud.agents')}</span>
          <span><b>{number.format(actingCount)}</b> {t('supervision.toolbar.acting', 'en action')}</span>
          <span className="baitly-constellation-toolbar__state" data-state={state}>
            <i aria-hidden="true" />
            {!online ? t('supervision.states.offline') : paused
              ? t('supervision.toolbar.paused', 'En pause')
              : t('supervision.toolbar.online', 'En ligne')}
          </span>
        </div>
      </div>
      {children && <div className="baitly-constellation-toolbar__controls">{children}</div>}
    </header>
  );
}
