import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, CircularProgress, Dialog, Tooltip } from '@mui/material';
import { Upload, X, ImageOff, Trash2 } from 'lucide-react';
import { mediaApi, type MediaAsset } from '../../../../services/api/mediaApi';
import { API_CONFIG } from '../../../../config/api';

/**
 * Médiathèque (2.1) — sélecteur d'image pour les champs image des blocs du Studio. Upload + grille
 * des médias de l'org + suppression. À la sélection, renvoie l'URL ABSOLUE (`BASE_URL + /api/public/
 * media/{id}`) afin qu'elle fonctionne sur toutes les surfaces (canvas, page publique, widget, SSR).
 */

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

/** Relatif → absolu (origine API), pour fonctionner cross-origin (dev) et hors SPA (widget/SSR). */
function resolveUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_CONFIG.BASE_URL}${url}`;
}

export default function MediaPicker({ open, onClose, onSelect }: MediaPickerProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    mediaApi.list()
      .then(setAssets)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    mediaApi.upload(file)
      .then((asset) => setAssets((prev) => [asset, ...prev]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Envoi impossible'))
      .finally(() => {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const handleDelete = (id: number) => {
    mediaApi.remove(id)
      .then(() => setAssets((prev) => prev.filter((a) => a.id !== id)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Suppression impossible'));
  };

  const pick = (asset: MediaAsset) => {
    onSelect(resolveUrl(asset.url));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 'var(--radius-lg)', bgcolor: 'var(--card)', backgroundImage: 'none' } }}
    >
      {/* En-tête */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, height: 56, borderBottom: '1px solid var(--line)' }}>
        <Box sx={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>Médiathèque</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" hidden onChange={(e) => handleFiles(e.target.files)} />
          <ButtonBase
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 34, px: 1.75,
              borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
              fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
              '&:hover': { bgcolor: 'var(--accent-deep)' }, '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            {uploading ? <CircularProgress size={15} color="inherit" /> : <Upload size={15} strokeWidth={2} />}
            {uploading ? 'Envoi…' : 'Importer'}
          </ButtonBase>
          <Tooltip title="Fermer">
            <ButtonBase onClick={onClose} aria-label="Fermer" sx={iconBtnSx}><X size={18} strokeWidth={2} /></ButtonBase>
          </Tooltip>
        </Box>
      </Box>

      {/* Corps */}
      <Box sx={{ p: 2.5, minHeight: 280, maxHeight: '60vh', overflowY: 'auto' }}>
        {error && <Box sx={{ mb: 1.5, fontSize: 'var(--text-sm)', color: 'var(--err)' }}>{error}</Box>}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
        ) : assets.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, color: 'var(--muted)', textAlign: 'center', gap: 1 }}>
            <ImageOff size={28} strokeWidth={1.6} />
            <Box sx={{ fontSize: 'var(--text-md)' }}>Aucun média pour le moment.</Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--faint)' }}>Importe une image (JPG, PNG, GIF, WebP, SVG — max 5 Mo).</Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
            {assets.map((asset) => (
              <Box key={asset.id} sx={{ position: 'relative', '&:hover .media-del': { opacity: 1 } }}>
                <ButtonBase
                  onClick={() => pick(asset)}
                  sx={{
                    display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    border: '1px solid var(--line)', bgcolor: 'var(--field)', cursor: 'pointer',
                    transition: 'border-color var(--duration-fast) var(--ease-out)',
                    '&:hover': { borderColor: 'var(--accent)' },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                  }}
                >
                  <Box component="img" src={resolveUrl(asset.url)} alt={asset.fileName ?? ''} loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </ButtonBase>
                <Tooltip title="Supprimer">
                  <ButtonBase
                    className="media-del"
                    onClick={() => handleDelete(asset.id)}
                    aria-label="Supprimer le média"
                    sx={{
                      position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                      bgcolor: 'var(--card)', color: 'var(--muted)', border: '1px solid var(--line)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      opacity: 0, transition: 'opacity var(--duration-fast) var(--ease-out)',
                      '&:hover': { color: 'var(--err)', borderColor: 'var(--err)' },
                    }}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </ButtonBase>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}

const iconBtnSx = {
  width: 32, height: 32, borderRadius: 'var(--radius-md)', color: 'var(--muted)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
} as const;
