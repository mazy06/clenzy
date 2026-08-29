import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import OnboardingDock from './baitly/OnboardingDock';
import type { OnboardingGroup } from './baitly/OnboardingSteps';
import { RocketLaunch } from '../icons';
import { useOnboarding } from '../hooks/useOnboarding';
import { useTranslation } from '../hooks/useTranslation';

// ─── Dock de démarrage persistant (projection Onboarding) ────────────────────
//
// Branche le primitive OnboardingDock (teardown) sur le VRAI parcours
// (useOnboarding : étapes par rôle, verrouillage séquentiel, complétion
// auto-détectée côté serveur). La checklist du dashboard reste la surface
// riche ; le dock suit l'utilisateur sur les AUTRES écrans, replié en bas à
// gauche — c'est lui qui ramène vers les étapes jamais atteintes une fois
// qu'on a quitté le dashboard.
//
// Le rejet (« Masquer ») partage le flag serveur avec la checklist : un seul
// guide, un seul état de rejet — le remontrer se fait depuis le dashboard.

/** Écrans où le dock ne doit PAS apparaître. */
const HIDDEN_PREFIXES = [
  // `/dashboard` figurait ici tant que le tableau de bord portait sa propre
  // checklist. Elle a ete supprimee (doublon) : le dock est desormais la seule
  // surface du guide, il doit donc s'y afficher aussi.
  '/booking-engine/studio/', // éditeur full-bleed
];

export default function OnboardingDockMount() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    steps,
    totalCount,
    isAllCompleted,
    isDismissed,
    isLoading,
    completeStep,
    dismiss,
  } = useOnboarding();

  const groups = useMemo<OnboardingGroup[]>(
    () => [
      {
        key: 'setup',
        title: t('dashboard.onboarding.title'),
        media: <RocketLaunch size={20} strokeWidth={1.75} />,
        steps: steps.map((step) => {
          const actionable = !step.completed && !step.locked;
          return {
            key: step.key,
            title: t(step.labelKey),
            description: t(step.descriptionKey),
            state: step.completed ? ('done' as const) : step.locked ? ('locked' as const) : ('todo' as const),
            // L'étape modale du dashboard (import iCal) navigue ici vers sa
            // page : le dock vit sur tous les écrans, pas la modale.
            action: actionable
              ? {
                  label: t('onboarding.dock.continue', 'Continuer'),
                  onClick: () => navigate(step.navigationPath),
                }
              : undefined,
            onSkip: actionable && step.skippable ? () => completeStep(step.key) : undefined,
            skipLabel: t('onboarding.skip'),
            // Jalons internes declares dans `onboardingConfig` (ex. creation du
            // compte Stripe puis validation KYC sous « Configurer mes
            // versements »). Ils suivent l'etat de leur etape tant que le
            // serveur ne les suit pas individuellement.
            substeps: step.substeps?.map((sub) => ({
              key: sub.key,
              title: t(sub.labelKey),
              state: step.completed ? ('done' as const) : ('todo' as const),
            })),
          };
        }),
      },
    ],
    [steps, t, navigate, completeStep],
  );

  // Silencieux : en chargement, sans parcours pour ce rôle, rejeté, ou terminé
  // (la fin visible du guide est célébrée par la checklist du dashboard).
  if (isLoading || totalCount === 0 || isDismissed || isAllCompleted) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <OnboardingDock
      groups={groups}
      title={t('onboarding.dock.title', 'Guide de démarrage')}
      onDismiss={dismiss}
      dismissLabel={t('dashboard.onboarding.dismiss', 'Masquer')}
      // Affordance desktop : sur mobile le dock couvrirait le contenu
      // (le parcours reste accessible via la checklist du dashboard).
      // Visible aussi sur telephone : le dock etait masque sous 900px alors
      // qu'il est desormais la SEULE surface du guide — un intervenant, qui
      // travaille justement sur mobile, n'en voyait plus aucune trace.
      className="flex"
    />
  );
}
