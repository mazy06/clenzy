import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Pagination } from '@mui/material';
import { LayoutGrid, Plus } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { bookingEngineApi } from '../../../services/api/bookingEngineApi';
import { GALLERY_TEMPLATES } from './grapes/import/galleryTemplates';
import { buildConfigPayload } from './StudioHome';
import './studioHome.css';

/**
 * Galerie COMPLÈTE des templates (écran « Voir tous les templates »). 4 colonnes, paginée pour tenir
 * SANS scroll : la taille de page est calculée depuis la hauteur disponible (lignes qui rentrent × 4).
 * Sélectionner une carte crée un booking engine (thème appliqué) et ouvre le Studio avec `templateId`
 * (auto-import géré par `GrapesStudio`) — même flux que l'aperçu de `StudioHome`.
 */

// Hauteur estimée d'une carte (.tpl-card : vignette 150 + corps ≈ 100) + gouttière (.tpl-grid gap).
const CARD_H = 256;
const GRID_GAP = 18;
const COLS = 4;

export default function TemplateGalleryPage() {
  const navigate = useNavigate();
  const areaRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(COLS * 2);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  // Calcule combien de lignes tiennent dans la zone disponible → taille de page (× 4 colonnes).
  useLayoutEffect(() => {
    const compute = () => {
      const el = areaRef.current;
      if (!el) return;
      const rows = Math.max(1, Math.floor((el.clientHeight + GRID_GAP) / (CARD_H + GRID_GAP)));
      setPageSize(rows * COLS);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (areaRef.current) ro.observe(areaRef.current);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, []);

  const total = GALLERY_TEMPLATES.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Reclampe la page courante si la taille de page change (resize) et la fait sortir des bornes.
  useEffect(() => { setPage((p) => Math.min(p, pageCount)); }, [pageCount]);

  const start = (page - 1) * pageSize;
  const items = GALLERY_TEMPLATES.slice(start, start + pageSize);

  const handleSelect = useCallback(async (id: string) => {
    if (creating) return;
    const tpl = GALLERY_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setCreating(true);
    try {
      const overrides = {
        ...(tpl.theme?.primaryColor ? { primaryColor: tpl.theme.primaryColor } : {}),
        ...(tpl.theme?.fontFamily ? { fontFamily: tpl.theme.fontFamily } : {}),
      };
      const created = await bookingEngineApi.createConfig({ ...buildConfigPayload(tpl.name), ...overrides });
      navigate(`/booking-engine/studio/${created.id}`, { state: { templateId: tpl.id } });
    } catch {
      setCreating(false); // l'erreur reste affichable côté Studio ; on réautorise la sélection
    }
  }, [creating, navigate]);

  return (
    <Box className="be-home" data-accent="indigo" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg)', px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title="Tous les templates"
          subtitle="Choisissez un modèle pour démarrer votre booking engine"
          iconBadge={<LayoutGrid />}
          titleAdornment={
            <Box
              component="span"
              sx={{
                fontSize: 12, fontWeight: 600, color: 'var(--muted)',
                bgcolor: 'var(--hover)', borderRadius: 999, px: 1, py: '2px',
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}
            >
              {total} modèles
            </Box>
          }
          onBack={() => navigate(-1)}
          backLabel="Retour"
        />
      </Box>

      <Box ref={areaRef} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className="tpl-grid tpl-grid--quad">
          {items.map((tpl) => {
            const c1 = tpl.theme?.primaryColor || 'var(--accent)';
            return (
              <article
                key={tpl.id} className="tpl-card" role="button" tabIndex={0}
                aria-disabled={creating}
                onClick={() => handleSelect(tpl.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(tpl.id); } }}
              >
                <div className="tpl-thumb">
                  {tpl.thumbnail ? (
                    <img src={tpl.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <div className="mini" style={{ ['--t1' as string]: c1, ['--t2' as string]: c1, ['--t3' as string]: 'var(--surface-2)' }}>
                      <div className="mini__bar"><span className="mini__logo" /><span className="mini__nav" /><span className="mini__nav" /><span className="mini__nav sp" /></div>
                      <div className="mini__hero"><span className="mini__h1" /><span className="mini__h2" /><span className="mini__search" /></div>
                      <div className="mini__cards"><span /><span /><span /></div>
                    </div>
                  )}
                  <div className="tpl-use"><span><Plus size={15} strokeWidth={2} /> Utiliser ce template</span></div>
                </div>
                <div className="tpl-body">
                  <p className="tpl-name">{tpl.name}</p>
                  <div className="tpl-meta">
                    <span className="tpl-tag">Recherche Catalogue</span>
                    {tpl.description && <span className="tpl-style">{tpl.description}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Box>

      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2, flexShrink: 0 }}>
          <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" shape="rounded" />
        </Box>
      )}
    </Box>
  );
}
