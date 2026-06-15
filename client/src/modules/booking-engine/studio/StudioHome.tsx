import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Skeleton } from '@mui/material';
import { Plus, LayoutTemplate, ArrowRight, AlertTriangle } from 'lucide-react';
import { bookingEngineApi, type BookingEngineConfig, type BookingEngineConfigUpdate } from '../../../services/api/bookingEngineApi';
import { type DesignPreset } from '../constants';
import { templateBlocksForPreset } from './siteTemplates';
import TemplateGallery from './TemplateGallery';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';

/**
 * Accueil du Baitly Studio (F1) : « Mes booking engines » (liste réelle via l'API admin) +
 * création depuis la galerie de templates. Ouvrir un projet → éditeur (StudioPage).
 */

const PRESET_LABELS: Record<string, string> = {
  'safari-lodge': 'Safari Lodge', 'stripe-minimal': 'Stripe Minimal', 'ocean-breeze': 'Ocean Breeze',
  'urban-chic': 'Urban Chic', 'provencal': 'Provençal', 'nordic': 'Nordic',
};

function buildConfigPayload(name: string, preset: DesignPreset | null): BookingEngineConfigUpdate {
  return {
    name,
    primaryColor: preset?.primaryColor ?? '#5453D6', // défaut indigo Baitly Signature
    accentColor: null,
    logoUrl: null,
    fontFamily: preset?.fontFamily ?? 'Inter',
    defaultLanguage: 'fr',
    defaultCurrency: 'EUR',
    minAdvanceDays: 1,
    maxAdvanceDays: 365,
    cancellationPolicy: null,
    termsUrl: null,
    privacyUrl: null,
    allowedOrigins: null,
    collectPaymentOnBooking: true,
    autoConfirm: true,
    showCleaningFee: true,
    showTouristTax: true,
    directBookingDiscountPercent: null,
    memberDiscountPercent: null,
    pendingHoldMinutes: null,
    customCss: null,
    customJs: null,
    componentConfig: null,
    pageLayout: preset ? (() => { const b = templateBlocksForPreset(preset.id); return b ? JSON.stringify(b) : null; })() : null,
    featuredPropertyIds: null,
    designTokens: preset ? JSON.stringify(preset.tokens) : null,
    sourceWebsiteUrl: null,
    aiAnalysisAt: null,
    widgetPosition: 'bottom',
    inlineTargetId: null,
    inlinePlacement: 'after',
  };
}

/**
 * @param embedded rendu DANS l'onglet « Booking Engine » de « Réservation & accueil »
 * (pas de chrome pleine page : header dans le PageHeader partagé du parent). `false` = route
 * autonome `/booking-engine/studio`.
 */
export default function StudioHome({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<BookingEngineConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    bookingEngineApi.listConfigs()
      .then((data) => { if (alive) setConfigs(data); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Erreur de chargement'); });
    return () => { alive = false; };
  }, []);

  const handleSelectTemplate = async (preset: DesignPreset | null) => {
    if (creating) return;
    setCreating(true);
    try {
      const name = preset ? `Site ${PRESET_LABELS[preset.id] ?? preset.id}` : 'Nouveau booking engine';
      const created = await bookingEngineApi.createConfig(buildConfigPayload(name, preset));
      navigate(`/booking-engine/studio/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
      setCreating(false);
      setGalleryOpen(false);
    }
  };

  const createButton = (
    <ButtonBase onClick={() => setGalleryOpen(true)} sx={primaryBtnSx}>
      <Plus size={16} strokeWidth={2.2} /> Créer un booking engine
    </ButtonBase>
  );

  // Mode embarqué : l'action « Créer » vit dans le PageHeader PARTAGÉ du parent (slot via
  // PageHeaderActionsContext), comme les onglets Livret & Services. Hook appelé inconditionnellement
  // (Rules of Hooks) ; hors provider (route autonome) il ne porte rien.
  const headerPortal = usePageHeaderActions(embedded ? createButton : null);

  const content = (
    <>
      {error && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, borderRadius: 'var(--radius-md)',
          bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
          <AlertTriangle size={16} strokeWidth={2} /> {error}
        </Box>
      )}

      {/* Loading */}
      {configs === null && !error && (
        <Box sx={gridSx}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={132} sx={{ borderRadius: 'var(--radius-lg)', bgcolor: 'var(--hover)' }} />
          ))}
        </Box>
      )}

      {/* Empty state (enseigne) */}
      {configs?.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-lg)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <LayoutTemplate size={26} strokeWidth={1.85} />
          </Box>
          <Box sx={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', mb: 0.5 }}>Aucun booking engine pour l'instant</Box>
          <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)', mb: 2.5 }}>Pars d'un template ou d'une page vierge.</Box>
          <ButtonBase onClick={() => setGalleryOpen(true)} sx={primaryBtnSx}>
            <Plus size={16} strokeWidth={2.2} /> Créer mon premier booking engine
          </ButtonBase>
        </Box>
      )}

      {/* Liste */}
      {configs && configs.length > 0 && (
        <Box sx={gridSx}>
          {configs.map((c) => (
            <ButtonBase
              key={c.id}
              onClick={() => navigate(`/booking-engine/studio/${c.id}`)}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left',
                p: 2, borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', bgcolor: 'var(--card)',
                cursor: 'pointer', transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
                '&:hover': { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-card)' },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
                  bgcolor: c.primaryColor || 'var(--accent)' }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</Box>
                  <StatusBadge enabled={c.enabled} />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', color: 'var(--accent)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
                Ouvrir <ArrowRight size={14} strokeWidth={2} />
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        <Box sx={{ color: 'var(--ink)', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
          {headerPortal}
          {content}
        </Box>
      ) : (
        <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg)', color: 'var(--ink)' }}>
          <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 4 }}>
              <Box>
                <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', mb: 0.5 }}>
                  Mes booking engines
                </Box>
                <Box sx={{ fontSize: 'var(--text-md)', color: 'var(--muted)' }}>
                  Conçois et diffuse tes sites de réservation directe.
                </Box>
              </Box>
              <Box sx={{ flex: 1 }} />
              {createButton}
            </Box>
            {content}
          </Box>
        </Box>
      )}

      <TemplateGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} onSelect={handleSelectTemplate} creating={creating} />
    </>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.25,
      fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)',
      color: enabled ? 'var(--ok)' : 'var(--muted)',
    }}>
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: enabled ? 'var(--ok)' : 'var(--faint)' }} />
      {enabled ? 'Actif' : 'Désactivé'}
    </Box>
  );
}

const gridSx = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 } as const;

const primaryBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 38, px: 2,
  borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
  fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer', flexShrink: 0,
  transition: 'background var(--duration-fast) var(--ease-out)',
  '&:hover': { bgcolor: 'var(--accent-deep)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;
