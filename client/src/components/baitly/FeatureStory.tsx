import * as React from 'react';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { Separator } from '../ui';
import { cn } from '../../utils/cn';
import Reveal from './Reveal';

/**
 * Baitly — charpente des états vides « format long ».
 *
 * Certains modules ne se vendent pas en une phrase : leur intérêt tient à un
 * mécanisme (la synchronisation, la conformité d'une facture, le cycle de vie
 * d'un code d'accès). Pour ceux-là, l'écran vide devient une **page
 * d'explication** : un schéma central, le mécanisme, les leviers, les garde-fous.
 *
 * Ce fichier ne contient que la **charpente répétée** d'une page à l'autre — les
 * schémas, eux, sont propres à chaque module et vivent avec lui. Sans ça, chaque
 * page réinventerait sa mise en page et la cohérence partirait au premier écran.
 *
 * À réserver aux modules dont l'enjeu n'est pas évident. Pour les autres, un
 * `ShowcaseEmpty` court suffit — une page longue sur un écran limpide est du
 * bruit.
 */

// ─── Accroche ───────────────────────────────────────────────────────────────

export interface StoryHeroProps {
  eyebrow: { icon?: React.ReactNode; label: React.ReactNode };
  /** La thèse de l'écran, pas son nom. */
  title: React.ReactNode;
  lede: React.ReactNode;
  actions?: React.ReactNode;
  /** Prérequis technique, en clair, sous les actions. */
  note?: React.ReactNode;
  /** Colonne droite : le schéma central, généralement dans un `MockupSlot`. */
  aside?: React.ReactNode;
}

export function StoryHero({ eyebrow, title, lede, actions, note, aside }: StoryHeroProps) {
  return (
    <section className="grid items-center gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-12">
      <Reveal className="min-w-0">
        <p className="m-0 mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {eyebrow.icon && (
            <span className="inline-flex text-primary [&>svg]:size-4">{eyebrow.icon}</span>
          )}
          {eyebrow.label}
        </p>
        <h2 className="cn-font-heading m-0 text-3xl leading-tight font-semibold text-balance text-foreground sm:text-4xl">
          {title}
        </h2>
        <p className="m-0 mt-4 max-w-xl text-base text-muted-foreground">{lede}</p>
        {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
        {note && <p className="m-0 mt-3 text-sm text-muted-foreground">{note}</p>}
      </Reveal>

      {aside && (
        <Reveal delay={120}>
          <div aria-hidden className="rounded-2xl bg-muted/60 p-6 select-none">
            {aside}
          </div>
        </Reveal>
      )}
    </section>
  );
}

// ─── Section courante ───────────────────────────────────────────────────────

export interface StorySectionProps {
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function StorySection({ title, lede, children, className }: StorySectionProps) {
  return (
    <section className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-2">
        <h3 className="cn-font-heading m-0 text-xl font-semibold text-foreground">{title}</h3>
        {lede && <p className="m-0 max-w-2xl text-sm text-muted-foreground">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

// ─── Zones commentées, à côté d'un schéma ───────────────────────────────────

export interface StoryZone {
  tag: string;
  text: React.ReactNode;
  /** La zone à retenir — une seule par bloc, sinon plus rien ne ressort. */
  highlight?: boolean;
}

export function StoryZones({ items, className }: { items: StoryZone[]; className?: string }) {
  return (
    <ol className={cn('m-0 flex list-none flex-col gap-3 p-0', className)}>
      {items.map((zone) => (
        <li
          key={zone.tag}
          className={cn(
            'rounded-lg border p-4',
            zone.highlight ? 'border-primary/40 bg-primary-soft' : 'border-border bg-card'
          )}
        >
          <div className="text-sm font-semibold text-foreground">{zone.tag}</div>
          <p className="m-0 mt-1 text-sm text-muted-foreground">{zone.text}</p>
        </li>
      ))}
    </ol>
  );
}

// ─── Enchaînement d'étapes ──────────────────────────────────────────────────

export interface StoryFlowStep {
  label: string;
  text: React.ReactNode;
}

/** Mécanisme en N étapes. Les flèches disparaissent en pile mobile. */
export function StoryFlow({ steps, className }: { steps: StoryFlowStep[]; className?: string }) {
  return (
    <ol className={cn('m-0 flex list-none flex-col gap-3 p-0 sm:flex-row sm:items-stretch', className)}>
      {steps.map((step, index) => (
        <li key={step.label} className="flex flex-1 items-center gap-3">
          <div className="flex-1 rounded-lg border border-border bg-card p-3">
            <div className="text-xs font-semibold text-foreground">{step.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{step.text}</div>
          </div>
          {index < steps.length - 1 && (
            <ArrowRightIcon
              aria-hidden
              className="hidden size-4 shrink-0 text-muted-foreground rtl:rotate-180 sm:block"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

// ─── Leviers / caractéristiques ─────────────────────────────────────────────

export interface StoryPoint {
  icon: React.ReactNode;
  title: string;
  text: React.ReactNode;
}

export function StoryPoints({ items, className }: { items: StoryPoint[]; className?: string }) {
  return (
    <ul className={cn('m-0 grid list-none gap-x-8 gap-y-5 p-0 sm:grid-cols-2', className)}>
      {items.map((point) => (
        <li key={point.title} className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&>svg]:size-4">
            {point.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{point.title}</span>
            <span className="block text-sm text-muted-foreground">{point.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Bande « ce qui nous distingue » ────────────────────────────────────────

export interface StoryBandProps {
  eyebrow: { icon?: React.ReactNode; label: React.ReactNode };
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  /** Liste de garanties, cochées, en pied de bande. */
  guarantees?: string[];
}

export function StoryBand({ eyebrow, title, lede, children, guarantees }: StoryBandProps) {
  return (
    <section className="rounded-2xl bg-primary-soft p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="m-0 flex items-center gap-2 text-sm font-medium text-primary">
          {eyebrow.icon && <span className="inline-flex [&>svg]:size-4">{eyebrow.icon}</span>}
          {eyebrow.label}
        </p>
        <h3 className="cn-font-heading m-0 text-xl font-semibold text-foreground">{title}</h3>
        {lede && <p className="m-0 max-w-2xl text-sm text-muted-foreground">{lede}</p>}
      </div>

      {children && <div className="mt-6">{children}</div>}

      {guarantees && guarantees.length > 0 && (
        <ul className="m-0 mt-6 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
          {guarantees.map((guarantee) => (
            <li key={guarantee} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckIcon className="size-4 shrink-0 text-primary" />
              {guarantee}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Reprise de l'action, en pied de page ───────────────────────────────────

export function StoryFooterCta({
  icon,
  title,
  text,
  actions,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="cn-font-heading m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
          {icon && <span className="inline-flex text-primary [&>svg]:size-5">{icon}</span>}
          {title}
        </h3>
        {text && <p className="m-0 mt-1 text-sm text-muted-foreground">{text}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </section>
  );
}

// ─── Mention discrète (illustrations, limites) ──────────────────────────────

export function StoryNote({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-xs text-muted-foreground">{children}</p>;
}

/** Conteneur de page longue : rythme vertical et séparateurs cohérents. */
export function StoryPage({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-14 pb-4">{children}</div>;
}

export { Separator as StorySeparator };
