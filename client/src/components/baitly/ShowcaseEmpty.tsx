import * as React from 'react';
import { cn } from '../../utils/cn';

/**
 * Baitly — état vide « vitrine », en deux colonnes.
 *
 * Complément de components/baitly/EmptyState.tsx (icône + titre + CTA, centré),
 * réservé aux écrans **entièrement** vides avant configuration : messagerie sans
 * canal, planning sans logement, rapports sans données.
 *
 * Trois règles qui le distinguent d'un état vide ordinaire :
 *  1. le **titre est la proposition de valeur de l'écran**, jamais « Aucun
 *     élément » — l'utilisateur qui arrive ici ne sait pas encore à quoi sert
 *     l'écran ;
 *  2. la colonne droite montre un **aperçu du produit rempli**, pour rendre la
 *     promesse tangible (convention : le texte secondaire de l'aperçu est en
 *     `Skeleton`, seuls les mots porteurs de sens restent lisibles — rien à
 *     traduire, aucune fausse donnée crédible à maintenir) ;
 *  3. `fallback` fournit une **sortie de secours** quand le CTA suppose un
 *     prérequis que l'utilisateur n'a pas — un état vide ne doit pas être un
 *     cul-de-sac.
 *
 * Usage :
 *   <ShowcaseEmpty
 *     eyebrow={{ icon: <InboxIcon />, label: 'Messagerie unifiée' }}
 *     title="Répondez à vos voyageurs de tous les canaux depuis une seule boîte"
 *     description="Connectez un canal pour commencer à recevoir les messages."
 *     action={<Button>Connecter un canal</Button>}
 *     fallback={<>Pas encore de canal ? <a href="…">Créer une réservation directe</a></>}
 *     preview={<MessagingPreview />}
 *   />
 */
export interface ShowcaseEmptyProps {
  /** Sur-titre discret : icône + nom de la fonctionnalité. */
  eyebrow?: { icon?: React.ReactNode; label: React.ReactNode };
  /** La proposition de valeur de l'écran, pas un constat de vide. */
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Sortie de secours quand le CTA suppose un prérequis absent. */
  fallback?: React.ReactNode;
  /** Aperçu du produit rempli, affiché dans un panneau à droite. */
  preview?: React.ReactNode;
  className?: string;
}

export default function ShowcaseEmpty({
  eyebrow,
  title,
  description,
  action,
  fallback,
  preview,
  className,
}: ShowcaseEmptyProps) {
  return (
    <section
      className={cn(
        'grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-12',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="m-0 mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {eyebrow.icon && (
              <span className="inline-flex text-primary [&>svg]:size-4">{eyebrow.icon}</span>
            )}
            {eyebrow.label}
          </p>
        )}
        <h2 className="cn-font-heading m-0 text-2xl leading-snug font-semibold text-balance text-foreground sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="m-0 mt-3 text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-6 flex flex-wrap items-center gap-3">{action}</div>}
        {fallback && (
          <p className="m-0 mt-3 text-sm text-muted-foreground [&>a]:font-medium [&>a]:text-primary [&>a]:underline [&>a]:underline-offset-4">
            {fallback}
          </p>
        )}
      </div>

      {preview && (
        <div
          aria-hidden
          className="overflow-hidden rounded-2xl bg-muted/60 p-6 select-none"
        >
          {preview}
        </div>
      )}
    </section>
  );
}
