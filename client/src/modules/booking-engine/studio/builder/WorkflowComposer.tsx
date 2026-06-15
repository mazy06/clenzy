import { useMemo } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { Search, Building2, UserRound, CreditCard, CheckCircle2, Wand2, RotateCcw, ArrowRight } from 'lucide-react';
import type { StudioConfigState } from '../useStudioConfig';

/**
 * Onglet « Parcours » : installe en un clic le FUNNEL de réservation complet (un seul bloc) —
 * recherche → logements & panier → coordonnées → paiement → confirmation. Concrètement, écrit une
 * composition `widgetLayout` complète dans `config.componentConfig` (rendue par le SDK). Les étapes
 * coordonnées → paiement Stripe → confirmation sont enchaînées AUTOMATIQUEMENT par le SDK ; cet
 * onglet ne configure que la page de recherche du funnel. Granulaire ? → onglet « Widget ».
 */

// Composition complète de la page de recherche (le SDK gère ensuite form → Stripe → confirmation).
const FUNNEL_LAYOUT = [
  { type: 'propertyResults' },
  { type: 'dates' },
  { type: 'guests' },
  { type: 'priceSummary' },
  { type: 'searchButton' },
  { type: 'addToCart' },
  { type: 'cart' },
];

const STEPS = [
  { icon: Search, label: 'Recherche', desc: 'Logement · dates · voyageurs' },
  { icon: Building2, label: 'Logements & panier', desc: 'Sélection + ajout au panier' },
  { icon: UserRound, label: 'Coordonnées', desc: 'Infos du voyageur' },
  { icon: CreditCard, label: 'Paiement', desc: 'Stripe sécurisé' },
  { icon: CheckCircle2, label: 'Confirmation', desc: 'Réservation validée' },
];

export interface WorkflowComposerProps {
  cfg: StudioConfigState;
}

export default function WorkflowComposer({ cfg }: WorkflowComposerProps) {
  const installed = useMemo(() => {
    try {
      const o = JSON.parse(cfg.config?.componentConfig || '{}');
      return Array.isArray(o?.widgetLayout) && o.widgetLayout.length > 0;
    } catch {
      return false;
    }
  }, [cfg.config?.componentConfig]);

  const writeLayout = (layout: unknown[]) => {
    let base: Record<string, unknown> = {};
    try { const o = JSON.parse(cfg.config?.componentConfig || '{}'); if (o && typeof o === 'object') base = o as Record<string, unknown>; } catch { /* repart de zéro */ }
    cfg.patch({ componentConfig: JSON.stringify({ ...base, widgetLayout: layout }) });
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', bgcolor: 'var(--bg-2, var(--bg))', display: 'flex', justifyContent: 'center', p: 3 }}>
      <Box sx={{ width: 'min(720px, 100%)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
            Parcours de réservation complet
          </Box>
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mt: 0.5, maxWidth: 560 }}>
            Le funnel entier en un seul bloc : la barre de recherche mène aux logements et au panier, puis
            tout se déroule jusqu'au paiement et à la validation. Pour un assemblage fin, utilise l'onglet <b>Widget</b>.
          </Box>
        </Box>

        {/* Étapes du parcours */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'stretch' }}>
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <Box key={step.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  flex: 1, minWidth: 150, display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5,
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)',
                }}>
                  <Box sx={{ display: 'inline-flex', color: 'var(--accent)', mt: 0.25 }}><Icon size={18} strokeWidth={2} /></Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{step.label}</Box>
                    <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.35 }}>{step.desc}</Box>
                  </Box>
                </Box>
                {i < STEPS.length - 1 ? <ArrowRight size={16} strokeWidth={2} style={{ color: 'var(--muted)', flexShrink: 0 }} /> : null}
              </Box>
            );
          })}
        </Box>

        {/* Action */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <ButtonBase onClick={() => writeLayout(FUNNEL_LAYOUT)} sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.5, height: 44, borderRadius: 'var(--radius-md)',
            bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', cursor: 'pointer',
            '&:hover': { bgcolor: 'var(--accent-deep, var(--accent))' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
          }}>
            <Wand2 size={17} strokeWidth={2} /> {installed ? 'Réinstaller le parcours complet' : 'Installer le parcours complet'}
          </ButtonBase>
          {installed ? (
            <ButtonBase onClick={() => writeLayout([])} sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2, height: 44, borderRadius: 'var(--radius-md)',
              color: 'var(--body)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
            }}>
              <RotateCcw size={15} strokeWidth={2} /> Réinitialiser
            </ButtonBase>
          ) : null}
          <Box sx={{ fontSize: 'var(--text-2xs)', color: installed ? 'var(--accent)' : 'var(--faint)' }}>
            {installed ? '✓ Parcours installé — visible dans l\'aperçu Réservation.' : 'Remplace la composition du widget par le funnel complet.'}
          </Box>
        </Box>

        <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.6, pt: 1, borderTop: '1px solid var(--line)' }}>
          Le SDK enchaîne <b>automatiquement</b> les étapes coordonnées → paiement Stripe → confirmation après la
          page de recherche. Cet onglet configure la composition ; bascule en <b>Aperçu</b> pour tester le flux de bout en bout.
        </Box>
      </Box>
    </Box>
  );
}
