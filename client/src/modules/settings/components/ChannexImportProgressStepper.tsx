/**
 * Channex Import Progress Stepper — Phase 1 (UX refactor wizard 3 etapes).
 *
 * <p>Stepper visuel place en tete du {@code ChannexImportDiscoveryDialog} pour
 * clarifier la progression a travers les 3 etapes du flow Connect :</p>
 * <ol>
 *   <li><b>Autoriser</b> : connecter un OTA cote hub (OAuth Airbnb/credentials Booking)</li>
 *   <li><b>Detecter</b> : Channex liste les properties detectees de cet OTA</li>
 *   <li><b>Synchroniser</b> : import dans Baitly + push initial automatique</li>
 * </ol>
 *
 * <p>L'etape courante est calculee depuis le state reel, et la progression est
 * STRICTEMENT monotone : une etape n'est franchie que si toutes les precedentes
 * le sont. Sans cette regle, le hub pouvait contenir des logements POUSSES
 * DEPUIS BAITLY (mode AUTO_CREATE de « Connecter un de mes logements », ou
 * pivot OAuth) alors qu'aucun compte OTA n'etait autorise : l'etape 1 et
 * l'etape 3 s'allumaient en meme temps et l'utilisateur atterrissait
 * visuellement sur « Synchroniser » sans avoir jamais connecte d'OTA.</p>
 *
 * <p>« Detecter » ne compte donc PAS le simple contenu du hub : il exige un OTA
 * autorise. {@code otaDetectedCount} distingue les listings reellement
 * rattaches a un OTA du reste du hub.</p>
 *
 * <p>Aucune navigation explicite : chaque etape est pilotee par l'action user
 * dans le dialog. Le stepper sert juste de boussole.</p>
 */
import React from 'react';
import { cn } from '../../../utils/cn';
import { Cable, Search, Check, ArrowRight } from 'lucide-react';

interface ChannexImportProgressStepperProps {
  /** Nb d'OTAs (Airbnb/Booking/...) deja connectes cote hub Channex. */
  connectedOtaCount: number;
  /** Nb total de logements presents dans le hub (OTA + pousses depuis Baitly). */
  totalInHub: number;
  /** Nb de logements du hub effectivement rattaches a un channel OTA. */
  otaDetectedCount: number;
  /** Nb de properties deja importees dans Baitly. */
  importedCount: number;
}

/** Accord en nombre sans repeter le ternaire a chaque libelle. */
function plural(count: number, singular: string, plural_: string): string {
  return `${count} ${count > 1 ? plural_ : singular}`;
}

type StepStatus = 'COMPLETE' | 'ACTIVE' | 'UPCOMING';

interface Step {
  num: number;
  title: string;
  hint: string;
  Icon: typeof Cable;
  status: StepStatus;
}

function computeSteps(p: ChannexImportProgressStepperProps): Step[] {
  const hasOta = p.connectedOtaCount > 0;
  // Un logement present dans le hub ne prouve PAS une detection OTA : il a pu y
  // etre pousse depuis Baitly. La detection exige un compte OTA autorise.
  const hasDetected = hasOta && p.totalInHub > 0;
  const hasImported = hasDetected && p.importedCount > 0;

  return [
    {
      num: 1,
      title: 'Autoriser',
      hint: hasOta
        ? plural(p.connectedOtaCount, 'compte OTA connecté', 'comptes OTA connectés')
        : 'Connectez votre compte Airbnb ou Booking',
      Icon: Cable,
      status: hasOta ? 'COMPLETE' : 'ACTIVE',
    },
    {
      num: 2,
      title: 'Détecter',
      hint: !hasOta
        ? 'En attente de l\'étape 1'
        : hasDetected
          ? plural(p.otaDetectedCount > 0 ? p.otaDetectedCount : p.totalInHub, 'annonce détectée', 'annonces détectées')
          : 'Recherche de vos annonces en cours',
      Icon: Search,
      status: !hasOta ? 'UPCOMING' : hasDetected ? 'COMPLETE' : 'ACTIVE',
    },
    {
      num: 3,
      title: 'Synchroniser',
      hint: hasImported
        ? plural(p.importedCount, 'annonce importée dans Baitly', 'annonces importées dans Baitly')
        : hasDetected
          ? 'Cochez les annonces, puis importez'
          : 'En attente de détection',
      Icon: Check,
      status: !hasDetected ? 'UPCOMING' : hasImported ? 'COMPLETE' : 'ACTIVE',
    },
  ];
}

/**
 * Teintes VIVES : elles peignent la pastille, sa bordure et la fleche de
 * liaison — jamais du texte (cf. contrat Baitly UI §2.4).
 */
const STATUS_COLOR: Record<StepStatus, string> = {
  COMPLETE: 'var(--bui-success)',
  ACTIVE:   'var(--bui-primary)',
  UPCOMING: 'var(--bui-faint)',
};

function StepBubble({ step }: { step: Step }) {
  const color = STATUS_COLOR[step.status];
  const Icon = step.status === 'COMPLETE' ? Check : step.Icon;
  return (
    <li
      className="flex items-start gap-1.5 min-w-0 flex-1"
      aria-current={step.status === 'ACTIVE' ? 'step' : undefined}
    >
      {/* Teintes derivees du statut a l'execution : elles restent dans style. */}
      <div
        className="size-8 rounded-full flex items-center justify-center shrink-0 mt-[0.6px] font-bold text-xs tabular-nums"
        style={{
          backgroundColor: step.status === 'UPCOMING'
            ? 'transparent'
            : `color-mix(in srgb, ${color} 10%, transparent)`,
          border: `2px solid ${color}`,
          color,
          boxShadow: step.status === 'ACTIVE'
            ? `0 0 0 4px color-mix(in srgb, ${color} 10%, transparent)`
            : undefined,
        }}
      >
        {step.status === 'COMPLETE' ? (
          <Icon size={14} strokeWidth={3} />
        ) : (
          step.num
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* `--bui-faint` plafonne a 2,41:1 : une etape a venir reste du texte,
            donc `--bui-muted-foreground` (4,80:1) — cf. contrat Baitly UI §2. */}
        <span className={cn('block text-xs font-semibold leading-[1.3]', step.status === 'UPCOMING' ? 'text-muted-foreground' : 'text-foreground')}>
          {step.title}
          <span className="sr-only">
            {step.status === 'COMPLETE' ? ' — terminée' : step.status === 'ACTIVE' ? ' — étape en cours' : ' — à venir'}
          </span>
        </span>
        <span className="block text-2xs text-muted-foreground leading-[1.4]">
          {step.hint}
        </span>
      </div>
    </li>
  );
}

function Connector({ next }: { next: StepStatus }) {
  const color = next === 'UPCOMING' ? 'var(--bui-border)' : STATUS_COLOR[next];
  // La fleche pointe le sens de lecture : elle se retourne en RTL avec la page.
  // Purement decorative : la progression est deja portee par `aria-current`.
  return (
    <li className="flex items-center shrink-0 mt-1.5 cn-rtl-flip" style={{ color }} aria-hidden="true">
      <ArrowRight size={14} strokeWidth={2.2} />
    </li>
  );
}

export default function ChannexImportProgressStepper(props: ChannexImportProgressStepperProps) {
  const steps = computeSteps(props);
  return (
    // L'ancien fond `${ACCENT}22` concatenait un alpha sur un `var()` : declaration
    // invalide, donc silencieusement sans effet. Les tokens Baitly portent leur
    // propre alpha.
    <div className="rounded-lg border border-solid border-primary/15 bg-primary-soft/50 p-[7.5px]">
      {/* `sm` MUI = 600 px, pas le 640 de Tailwind. spacing 1/1.25 = 6 px/7,5 px. */}
      <ol
        aria-label="Progression de la connexion"
        className="flex flex-col gap-1.5 items-start min-[600px]:flex-row min-[600px]:gap-[7.5px] min-[600px]:items-center"
      >
        <StepBubble step={steps[0]} />
        <Connector next={steps[1].status} />
        <StepBubble step={steps[1]} />
        <Connector next={steps[2].status} />
        <StepBubble step={steps[2]} />
      </ol>
    </div>
  );
}
