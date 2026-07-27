import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Baitly — réglage exprimé sous forme de phrase, avec les contrôles en ligne.
 *
 * Au lieu d'une pile « libellé / champ » qui oblige à reconstruire mentalement
 * la règle (« Statut cible : inconnu » + « Délai (jours) : 5 »), on écrit la
 * règle telle qu'elle se lit :
 *
 *   Marquer le logement [inconnu ▾] après [5 ▾] jours
 *
 * Le composant ne fournit que la mise en page (alignement sur la ligne de base,
 * retour à la ligne propre, calibrage des contrôles inline) — les contrôles
 * restent des `Select` / `Input` / `NativeSelect` standard.
 *
 * Usage :
 *   <SettingSentence label="Statut de ménage" help={<HelpPopover … />}>
 *     Marquer le logement
 *     <Select …><SelectTrigger className="w-40">…</SelectTrigger>…</Select>
 *     après
 *     <Input type="number" className="w-16" … />
 *     jours
 *   </SettingSentence>
 */
export interface SettingSentenceProps {
  /** Intitulé au-dessus de la phrase. Optionnel : la phrase peut se suffire. */
  label?: React.ReactNode;
  /** Précision sous l'intitulé (le « pourquoi » du réglage). */
  description?: React.ReactNode;
  /** Zone d'aide alignée à droite de l'intitulé (HelpPopover, lien…). */
  help?: React.ReactNode;
  /** Grise et neutralise l'ensemble de la phrase. */
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function SettingSentence({
  label,
  description,
  help,
  disabled = false,
  children,
  className,
}: SettingSentenceProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {(label || help) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {label && <div className="text-sm font-medium text-foreground">{label}</div>}
            {description && (
              <p className="m-0 mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {help && <div className="shrink-0">{help}</div>}
        </div>
      )}
      <div
        aria-disabled={disabled || undefined}
        className={cn(
          // `leading-8` réserve la hauteur d'un contrôle : le texte et les
          // champs restent sur la même ligne optique même après retour à la ligne.
          'flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm leading-8 text-foreground',
          // Calibrage des contrôles inline : plus compacts que dans un formulaire
          // classique, pour que la phrase reste lisible comme une phrase.
          '[&_[data-slot=select-trigger]]:h-8 [&_[data-slot=select-trigger]]:py-0',
          '[&_input]:h-8 [&_select]:h-8',
          disabled && 'pointer-events-none opacity-55'
        )}
      >
        {children}
      </div>
    </div>
  );
}
