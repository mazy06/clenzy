/* ============================================================
   <SupervisionDemo> — harnais de démonstration autonome

   Un faux bandeau « planning » (cellules avec data-reservation-id) au-dessus
   du SupervisionPanel branché sur le mock. Permet de voir la constellation
   tourner ET la comète relier un agent à une cellule, SANS toucher au vrai
   module Planning (intégration réelle = étape dédiée).

   - au chargement : Communication agit sur « Famille Roux » → comète
   - à la validation : Revenue agit sur « Léa Marchand » → comète
   ============================================================ */


import { SupervisionView } from './SupervisionView';
import { cn } from '../../../utils/cn';
import { MOCK_RESERVATION_FAMILLE_ROUX, MOCK_RESERVATION_LEA_MARCHAND } from '../provider/mockData';

// `bg` : fond pastel Baitly UI (§2.4 — les `-soft` sont des FONDS, l'encre
// reste `text-foreground`). Trois teintes seulement pour distinguer les cellules.
const CELLS = [
  { id: MOCK_RESERVATION_FAMILLE_ROUX, label: 'Famille Roux', sub: '8–12 juil.', bg: 'bg-info-soft' },
  { id: 'resa-thomas', label: 'Thomas R.', sub: '14–17 juil.', bg: 'bg-primary-soft' },
  { id: MOCK_RESERVATION_LEA_MARCHAND, label: 'Léa Marchand', sub: '20–22 juil.', bg: 'bg-destructive-soft' },
];

export function SupervisionDemo() {
  return (
    <div className="p-3 max-w-[1100px] mx-auto">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        Planning (démo) — cible des comètes
      </p>
      <div className="flex gap-1.5 mb-3">
        {CELLS.map((cell) => (
          <div
            className={cn('flex-1 p-[7.5px] rounded-md border border-solid border-border', cell.bg)}
            key={cell.id}
            data-reservation-id={cell.id}
          >
            <p className="text-sm font-semibold text-foreground">{cell.label}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{cell.sub}</p>
          </div>
        ))}
      </div>
      <SupervisionView propertyId="demo" />
    </div>
  );
}
