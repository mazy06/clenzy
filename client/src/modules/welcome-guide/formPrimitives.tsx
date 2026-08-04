import React from 'react';
import { Switch } from '../../components/ui';

/**
 * Primitives de formulaire partagées par les onglets « Réservation & accueil »
 * (Livret d'accueil + Services payants) — identité PMS épurée : icône inline
 * discrète, en-têtes cohérents, états vides compacts.
 */

/** En-tête de section : overline « Signature » (10.5px fw700 uppercase --faint) + actions à droite. */
export const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; actions?: React.ReactNode }> = ({
  icon,
  title,
  actions,
}) => (
  <div className="flex items-center justify-between gap-1.5 mb-2">
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="shrink-0 flex text-[var(--faint)]">{icon}</div>
      <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
        {title}
      </p>
    </div>
    {actions ? <div className="flex gap-0.5 shrink-0">{actions}</div> : null}
  </div>
);

/** État vide compact d'une section : encart pointillé discret + icône + texte court. */
export const EmptyHint: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="flex items-center gap-[7.5px] px-[10.5px] py-[9px] rounded-[10px] border border-dashed border-[var(--line-2)] bg-[var(--hover)]">
    <div className="shrink-0 flex text-[var(--faint)]">{icon}</div>
    <p className="cn-text-body1 text-[12.5px] leading-[1.5] text-[var(--muted)]">
      {text}
    </p>
  </div>
);

/** Ligne de réglage (toggle) : icône + libellé + description + Switch à droite. */
export const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, description, checked, onChange }) => (
  <div className="flex items-center gap-2 py-2">
    <div className="shrink-0 flex text-muted-foreground">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="cn-text-body2 font-semibold leading-[1.3]">
        {label}
      </p>
      <span className="cn-text-caption text-muted-foreground block leading-[1.3]">
        {description}
      </span>
    </div>
    {/* Le libelle de la ligne nomme le reglage : il est repris en aria-label,
        faute d'etiquette <label> associable dans ce gabarit. */}
    <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
  </div>
);
