import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Skeleton } from '../../components/ui';
import { CalendarMonth } from '../../icons';
import ShowcaseEmpty from '../../components/baitly/ShowcaseEmpty';
import ShowcaseCycler from '../../components/baitly/ShowcaseCycler';
import MockupSlot from '../../components/baitly/MockupSlot';
import airbnbLogo from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogo from '../../assets/logo/booking-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';

/**
 * État vide du Planning quand l'organisation n'a **encore aucun logement**.
 *
 * Distinct de l'état « le filtre ne laisse rien passer » (rendu par
 * `EmptyState` dans `PlanningPage`) : ici l'utilisateur n'a rien à
 * réinitialiser, il découvre l'écran. Le titre porte donc la proposition de
 * valeur du planning, pas le constat du vide, et la colonne droite montre à
 * quoi l'écran ressemblera rempli (convention `ShowcaseEmpty` : texte
 * secondaire en barres de squelette, rien à traduire ni à maintenir).
 *
 * L'action principale est « Ajouter un logement » et non « Connecter un
 * canal » : sans logement, un canal connecté n'a rien à synchroniser. La
 * sortie de secours mène à l'import, pour qui gère déjà ses biens ailleurs.
 */

function PreviewCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-3">{children}</div>;
}

/** Mini-planning : colonne de logements, bandes d'occupation, canal d'origine. */
function CalendarPreview() {
  const bars = [
    { start: 1, span: 3, tone: 'bg-primary', logo: airbnbLogo },
    { start: 4, span: 2, tone: 'bg-success', logo: bookingLogo },
    { start: 0, span: 2, tone: 'bg-warning', logo: vrboLogo },
  ];
  return (
    <PreviewCard>
      <div className="flex gap-2">
        <div className="flex w-16 shrink-0 flex-col gap-3 pt-5">
          {bars.map((_, index) => (
            <Skeleton key={index} className="h-2 w-full" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-2 w-full" />
            ))}
          </div>
          {bars.map((bar, index) => (
            <div key={index} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, cell) => {
                const filled = cell >= bar.start && cell < bar.start + bar.span;
                const last = cell === bar.start + bar.span - 1;
                return (
                  <div
                    key={cell}
                    className={`flex h-4 items-center justify-end rounded-sm pe-0.5 ${
                      filled ? bar.tone : 'bg-muted'
                    }`}
                  >
                    {/* Le canal d'origine se lit en bout de barre, comme sur la
                        vraie grille. */}
                    {filled && last && (
                      <img src={bar.logo} alt="" className="size-3 rounded-[2px] bg-card object-contain p-px" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

/** Liste des canaux branchés sur un même logement. */
function ChannelListPreview() {
  const channels = [airbnbLogo, bookingLogo, vrboLogo];
  return (
    <div className="flex flex-col gap-2">
      {channels.map((logo, index) => (
        <PreviewCard key={index}>
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="size-5 shrink-0 object-contain" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-2 w-24" />
              <Skeleton className="h-2 w-3/4" />
            </div>
            <span className="size-2 shrink-0 rounded-full bg-success" />
          </div>
        </PreviewCard>
      ))}
    </div>
  );
}

export interface PlanningEmptyShowcaseProps {
  /** Ouvre le choix de source d'import (iCal, Channex, canal direct). */
  onImport: () => void;
}

export default function PlanningEmptyShowcase({ onImport }: PlanningEmptyShowcaseProps) {
  const navigate = useNavigate();

  return (
    <ShowcaseEmpty
      className="mx-auto w-full max-w-5xl px-3"
      eyebrow={{ icon: <CalendarMonth size={14} strokeWidth={1.75} />, label: 'Planning' }}
      title="Un seul calendrier pour tous vos logements et tous vos canaux"
      description="Les disponibilités se synchronisent dans les deux sens avec Airbnb, Booking et les autres. Plus de double réservation."
      action={<Button onClick={() => navigate('/properties/new')}>Ajouter un logement</Button>}
      fallback={
        <>
          Vos biens sont déjà en ligne ailleurs ?{' '}
          <button
            type="button"
            onClick={onImport}
            className="cursor-pointer bg-transparent p-0 font-medium text-primary underline underline-offset-4"
          >
            Importer vos logements et leurs calendriers
          </button>
        </>
      }
      preview={
        <MockupSlot
          brief="Une réservation glisse sur la grille, la barre se pose sur les bonnes nuits, et le badge du canal d'origine apparaît en bout de barre."
          poster={
            <ShowcaseCycler
              frames={[
                { key: 'calendar', node: <CalendarPreview /> },
                { key: 'channels', node: <ChannelListPreview /> },
              ]}
            />
          }
        />
      }
    />
  );
}
