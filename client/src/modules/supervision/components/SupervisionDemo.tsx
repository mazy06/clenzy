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

const CELLS = [
  { id: MOCK_RESERVATION_FAMILLE_ROUX, label: 'Famille Roux', sub: '8–12 juil.', bg: '#E7EFFE' },
  { id: 'resa-thomas', label: 'Thomas R.', sub: '14–17 juil.', bg: '#EEEDFC' },
  { id: MOCK_RESERVATION_LEA_MARCHAND, label: 'Léa Marchand', sub: '20–22 juil.', bg: '#FFEBEC' },
];

export function SupervisionDemo() {
  return (
    <div className="p-3 max-w-[1100px] mx-auto">
      <p className="cn-text-body1 text-[12px] font-bold text-[var(--muted,_#6b7196)] mb-1.5">
        Planning (démo) — cible des comètes
      </p>
      <div className="flex gap-1.5 mb-3">
        {CELLS.map((cell) => (
          <div className="flex-1 p-[7.5px] rounded-[8px] border border-solid border-[var(--line,_#e6e8ef)]" style={{ backgroundColor: cell.bg }} key={cell.id} data-reservation-id={cell.id}>
            <p className="cn-text-body1 text-[13px] font-extrabold text-[var(--ink,_#1b2240)]">{cell.label}</p>
            <p className="cn-text-body1 text-[11.5px] text-[var(--muted,_#6b7196)]">{cell.sub}</p>
          </div>
        ))}
      </div>
      <SupervisionView propertyId="demo" />
    </div>
  );
}
