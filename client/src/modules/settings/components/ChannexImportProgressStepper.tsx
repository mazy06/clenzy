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
 * <p>L'etape courante est calculee depuis le state reel :</p>
 * <ul>
 *   <li>0 OTA connecte → etape 1 active</li>
 *   <li>OTA connecte mais 0 detection → etape 2 active</li>
 *   <li>Properties detectees mais 0 importee → etape 3 active</li>
 *   <li>Au moins 1 importee → etape 3 completed</li>
 * </ul>
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
  /** Nb de properties detectees par Channex (mappees + non mappees). */
  totalInHub: number;
  /** Nb de properties deja importees dans Baitly. */
  importedCount: number;
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
  const hasHubProps = p.totalInHub > 0;
  const hasImported = p.importedCount > 0;

  return [
    {
      num: 1,
      title: 'Autoriser',
      hint: hasOta
        ? `${p.connectedOtaCount} OTA connecte${p.connectedOtaCount > 1 ? 's' : ''}`
        : 'Connecter Airbnb / Booking au hub',
      Icon: Cable,
      status: hasOta ? 'COMPLETE' : 'ACTIVE',
    },
    {
      num: 2,
      title: 'Detecter',
      hint: hasHubProps
        ? `${p.totalInHub} property${p.totalInHub > 1 ? 'ies' : ''} detectee${p.totalInHub > 1 ? 's' : ''}`
        : hasOta
          ? 'Channex va lister vos listings'
          : 'En attente de l\'etape precedente',
      Icon: Search,
      status: !hasOta ? 'UPCOMING' : hasHubProps ? 'COMPLETE' : 'ACTIVE',
    },
    {
      num: 3,
      title: 'Synchroniser',
      hint: hasImported
        ? `${p.importedCount} importee${p.importedCount > 1 ? 's' : ''} dans Baitly`
        : hasHubProps
          ? 'Cocher + Importer en bas du tableau'
          : 'En attente de detection',
      Icon: Check,
      status: !hasHubProps ? 'UPCOMING' : hasImported ? 'COMPLETE' : 'ACTIVE',
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
    <div className="flex items-start gap-1.5 min-w-0 flex-1">
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
        <span className={cn('block text-xs font-semibold leading-[1.3]', step.status === 'UPCOMING' ? 'text-faint' : 'text-foreground')}>
          {step.title}
        </span>
        <span className={cn('block text-2xs text-muted-foreground leading-[1.4]', step.status === 'UPCOMING' ? 'opacity-60' : 'opacity-100')}>
          {step.hint}
        </span>
      </div>
    </div>
  );
}

function Connector({ next }: { next: StepStatus }) {
  const color = next === 'UPCOMING' ? 'var(--bui-border)' : STATUS_COLOR[next];
  // La fleche pointe le sens de lecture : elle se retourne en RTL avec la page.
  return (
    <div className="flex items-center shrink-0 mt-1.5 cn-rtl-flip" style={{ color }}>
      <ArrowRight size={14} strokeWidth={2.2} />
    </div>
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
      <div className="flex flex-col gap-1.5 items-start min-[600px]:flex-row min-[600px]:gap-[7.5px] min-[600px]:items-center">
        <StepBubble step={steps[0]} />
        <Connector next={steps[1].status} />
        <StepBubble step={steps[1]} />
        <Connector next={steps[2].status} />
        <StepBubble step={steps[2]} />
      </div>
    </div>
  );
}
