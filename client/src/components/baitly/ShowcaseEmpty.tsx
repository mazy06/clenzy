import * as React from 'react';
import { FirstUseStage, Packshot } from './FirstUseStage';
import { cn } from '../../utils/cn';

/**
 * Baitly — état vide « vitrine », sur la scène des écrans de première arrivée
 * (claire en thème clair, bleu nuit en thème sombre).
 *
 * Complément de components/baitly/EmptyState.tsx (icône + titre + CTA, centré),
 * réservé aux écrans **entièrement** vides avant configuration : voyageurs sans
 * réservation, notifications sans règle, portail sans propriétaire.
 *
 * Trois règles qui le distinguent d'un état vide ordinaire :
 *  1. le **titre est la proposition de valeur de l'écran**, jamais « Aucun
 *     élément » — l'utilisateur qui arrive ici ne sait pas encore à quoi sert
 *     l'écran ;
 *  2. le **visuel** (illustration générée, ou aperçu du produit rempli) rend la
 *     promesse tangible : on montre, on ne décrit pas — `description` tient en
 *     une ligne ;
 *  3. `fallback` fournit une **sortie de secours** quand le CTA suppose un
 *     prérequis que l'utilisateur n'a pas — un état vide ne doit pas être un
 *     cul-de-sac.
 *
 * Usage :
 *   <ShowcaseEmpty
 *     eyebrow={{ icon: <InboxIcon />, label: 'Messagerie unifiée' }}
 *     title="Répondez à vos voyageurs depuis une seule boîte"
 *     description="Connectez un canal pour recevoir les messages."
 *     action={<Button>Connecter un canal</Button>}
 *     fallback={<>Pas encore de canal ? <a href="…">Créer une réservation directe</a></>}
 *     image={STAGE_IMAGES.inbox}
 *   />
 */
export interface ShowcaseEmptyProps {
  /** Sur-titre discret : icône + nom de la fonctionnalité. */
  eyebrow?: { icon?: React.ReactNode; label: React.ReactNode };
  /** La proposition de valeur de l'écran, pas un constat de vide. */
  title: React.ReactNode;
  /** Une ligne — l'image et le titre portent le reste. */
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Sortie de secours quand le CTA suppose un prérequis absent. */
  fallback?: React.ReactNode;
  /** Illustration générée (voir `stageImages`), posée sur la scène. */
  image?: string;
  /** Aperçu du produit rempli, à droite — prioritaire sur `image`. */
  preview?: React.ReactNode;
  className?: string;
}

export default function ShowcaseEmpty({
  eyebrow,
  title,
  description,
  action,
  fallback,
  image,
  preview,
  className,
}: ShowcaseEmptyProps) {
  const visual = preview ? (
    <div aria-hidden className="ns-card select-none">{preview}</div>
  ) : image ? (
    <div aria-hidden className="ns-art">
      <Packshot src={image} size="2xl" />
    </div>
  ) : undefined;

  return (
    <div className={cn('py-4', className)}>
      <FirstUseStage
        className="ns--compact"
        icon={eyebrow?.icon}
        eyebrow={eyebrow?.label}
        title={title}
        lede={description}
        actions={action}
        extra={fallback ? (
          <p className="m-0 mt-4 text-sm text-[var(--ns-muted)] [&>a]:font-medium [&>a]:text-[var(--ns-ink)] [&>a]:underline [&>a]:underline-offset-4">
            {fallback}
          </p>
        ) : undefined}
        visual={visual}
      />
    </div>
  );
}
