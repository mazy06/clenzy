/* ============================================================
   <SupervisionDemo> — harnais de démonstration autonome

   Un faux bandeau « planning » (cellules avec data-reservation-id) au-dessus
   du SupervisionPanel branché sur le mock. Permet de voir la constellation
   tourner ET la comète relier un agent à une cellule, SANS toucher au vrai
   module Planning (intégration réelle = étape dédiée).

   - au chargement : Communication agit sur « Famille Roux » → comète
   - à la validation : Revenue agit sur « Léa Marchand » → comète
   ============================================================ */

import { Box, Typography } from '@mui/material';
import { SupervisionView } from './SupervisionView';
import { MOCK_RESERVATION_FAMILLE_ROUX, MOCK_RESERVATION_LEA_MARCHAND } from '../provider/mockData';

const CELLS = [
  { id: MOCK_RESERVATION_FAMILLE_ROUX, label: 'Famille Roux', sub: '8–12 juil.', bg: '#E7EFFE' },
  { id: 'resa-thomas', label: 'Thomas R.', sub: '14–17 juil.', bg: '#EEEDFC' },
  { id: MOCK_RESERVATION_LEA_MARCHAND, label: 'Léa Marchand', sub: '20–22 juil.', bg: '#FFEBEC' },
];

export function SupervisionDemo() {
  return (
    <Box sx={{ p: 2, maxWidth: 1100, mx: 'auto' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--muted, #6b7196)', mb: 1 }}>
        Planning (démo) — cible des comètes
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {CELLS.map((cell) => (
          <Box
            key={cell.id}
            data-reservation-id={cell.id}
            sx={{
              flex: 1,
              p: 1.25,
              borderRadius: '8px',
              bgcolor: cell.bg,
              border: '1px solid var(--line, #e6e8ef)',
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--ink, #1b2240)' }}>{cell.label}</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'var(--muted, #6b7196)' }}>{cell.sub}</Typography>
          </Box>
        ))}
      </Box>
      <SupervisionView propertyId="demo" />
    </Box>
  );
}
