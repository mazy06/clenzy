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
import { Box, Typography, Stack } from '@mui/material';
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

const ACCENT = '#6B8A9A';
const STATUS_COLOR: Record<StepStatus, string> = {
  COMPLETE: '#059669',
  ACTIVE:   ACCENT,
  UPCOMING: '#9CA3AF',
};

function StepBubble({ step }: { step: Step }) {
  const color = STATUS_COLOR[step.status];
  const Icon = step.status === 'COMPLETE' ? Check : step.Icon;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0, flex: 1 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: step.status === 'UPCOMING' ? 'transparent' : `${color}1A`,
          border: `2px solid ${color}`,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.1,
          fontWeight: 700,
          fontSize: '0.75rem',
          ...(step.status === 'ACTIVE' && {
            boxShadow: `0 0 0 4px ${color}1A`,
          }),
        }}
      >
        {step.status === 'COMPLETE' ? (
          <Icon size={14} strokeWidth={3} />
        ) : (
          step.num
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            fontWeight: 700,
            fontSize: '0.78rem',
            color: step.status === 'UPCOMING' ? 'text.disabled' : 'text.primary',
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            fontSize: '0.68rem',
            lineHeight: 1.4,
            opacity: step.status === 'UPCOMING' ? 0.6 : 1,
          }}
        >
          {step.hint}
        </Typography>
      </Box>
    </Box>
  );
}

function Connector({ next }: { next: StepStatus }) {
  const color = next === 'UPCOMING' ? '#E5E7EB' : STATUS_COLOR[next];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', color, flexShrink: 0, mt: 1 }}>
      <ArrowRight size={14} strokeWidth={2.2} />
    </Box>
  );
}

export default function ChannexImportProgressStepper(props: ChannexImportProgressStepperProps) {
  const steps = computeSteps(props);
  return (
    <Box
      sx={{
        border: `1px solid ${ACCENT}22`,
        bgcolor: `${ACCENT}06`,
        borderRadius: 1,
        p: 1.25,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1, sm: 1.25 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
      >
        <StepBubble step={steps[0]} />
        <Connector next={steps[1].status} />
        <StepBubble step={steps[1]} />
        <Connector next={steps[2].status} />
        <StepBubble step={steps[2]} />
      </Stack>
    </Box>
  );
}
