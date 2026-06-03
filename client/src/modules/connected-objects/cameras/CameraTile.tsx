import { useState } from 'react';
import { Box, Typography, Chip, Tooltip, IconButton, alpha } from '@mui/material';
import { PlayArrow, FiberManualRecord, Fullscreen, WifiOff, PhotoCamera, Refresh } from '../../../icons';
import type { MockCamera } from './mockCameras';

const ACCENT = '#C97A7A'; // argile Baitly (couleur du type « caméra »)
const FEED_BG = '#10171C'; // surface « feed » très sombre, tintée bleu-gris (jamais #000)

/**
 * Tuile caméra — surface « feed » 16:9. Lecture À LA DEMANDE (jamais d'autoplay) :
 * un clic révèle l'état flux ; le streaming réel viendra avec la passerelle média
 * (Phase 2). Respecte la palette Baitly et les bans Impeccable (pas de
 * glassmorphism, pas de side-stripe ; surface tintée vers le hue produit).
 */
export default function CameraTile({ camera }: { camera: MockCamera }) {
  const [streaming, setStreaming] = useState(false);

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'border-color 200ms',
        '&:hover': { borderColor: alpha(ACCENT, 0.5) },
      }}
    >
      {/* ── Zone feed 16:9 ── */}
      <Box
        role={camera.online ? 'button' : undefined}
        tabIndex={camera.online ? 0 : undefined}
        onClick={() => camera.online && setStreaming((s) => !s)}
        onKeyDown={(e) => {
          if (camera.online && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setStreaming((s) => !s);
          }
        }}
        sx={{
          position: 'relative',
          aspectRatio: '16 / 9',
          bgcolor: FEED_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: camera.online ? 'pointer' : 'default',
          outline: 'none',
          '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${ACCENT}` },
          '&:hover .co-cam-play': { bgcolor: alpha(ACCENT, 0.9) },
        }}
      >
        {/* Halo radial subtil (évoque un capteur, pas de glassmorphism) */}
        <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 38%, ${alpha('#2C3E48', 0.55)}, ${FEED_BG} 72%)` }} />

        {/* Pills haut : état + REC */}
        <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
          {camera.online ? (
            <Chip
              size="small"
              icon={<FiberManualRecord size={9} />}
              label="EN DIRECT"
              sx={{
                height: 20,
                bgcolor: alpha('#4A9B8E', 0.92),
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.6rem',
                letterSpacing: '0.06em',
                '& .MuiChip-icon': {
                  color: '#fff',
                  ml: '5px',
                  animation: 'coLive 1.8s ease-in-out infinite',
                },
                '@keyframes coLive': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
                '@media (prefers-reduced-motion: reduce)': { '& .MuiChip-icon': { animation: 'none' } },
              }}
            />
          ) : (
            <Chip size="small" label="Hors ligne" sx={{ height: 20, bgcolor: alpha('#9CA3AF', 0.85), color: '#fff', fontWeight: 600, fontSize: '0.6rem' }} />
          )}
          {camera.recording && (
            <Tooltip title="Enregistrement" arrow>
              <Box component="span" sx={{ color: ACCENT, display: 'inline-flex' }}><FiberManualRecord size={12} /></Box>
            </Tooltip>
          )}
        </Box>

        {/* Centre : play à la demande / état flux / injoignable */}
        {camera.online ? (
          streaming ? (
            <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', px: 2 }}>
              <Typography sx={{ color: alpha('#fff', 0.9), fontSize: '0.72rem', fontWeight: 600 }}>Flux en direct</Typography>
              <Typography sx={{ color: alpha('#fff', 0.55), fontSize: '0.62rem', mt: 0.25, lineHeight: 1.3 }}>
                Aperçu — le streaming réel arrivera avec la passerelle média (Phase 2)
              </Typography>
            </Box>
          ) : (
            <Box
              className="co-cam-play"
              sx={{
                position: 'relative', zIndex: 2,
                width: 46, height: 46, borderRadius: '50%',
                bgcolor: alpha('#fff', 0.14), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 150ms',
              }}
            >
              <PlayArrow size={24} />
            </Box>
          )
        ) : (
          <Box sx={{ position: 'relative', zIndex: 2, color: alpha('#fff', 0.45), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <WifiOff size={22} />
            <Typography sx={{ fontSize: '0.62rem' }}>Caméra injoignable</Typography>
          </Box>
        )}

        {/* Overlay bas : nom + pièce + dernier instantané */}
        <Box sx={{ position: 'absolute', left: 10, right: 10, bottom: 8, zIndex: 2 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2, textShadow: '0 1px 4px rgba(12,18,22,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {camera.name}
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.78), fontSize: '0.65rem', textShadow: '0 1px 3px rgba(12,18,22,0.7)', fontVariantNumeric: 'tabular-nums' }}>
            {camera.roomName} · {camera.lastSnapshotLabel}
          </Typography>
        </Box>
      </Box>

      {/* ── Footer : marque + actions (à venir) ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.75 }}>
        <Box component="span" sx={{ color: ACCENT, display: 'inline-flex' }}><PhotoCamera size={14} strokeWidth={1.75} /></Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{camera.brand}</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
          <Tooltip title="Rafraîchir l'instantané (Phase 2)" arrow>
            <span><IconButton size="small" disabled sx={{ color: 'text.disabled' }}><Refresh size={15} /></IconButton></span>
          </Tooltip>
          <Tooltip title="Plein écran (Phase 2)" arrow>
            <span><IconButton size="small" disabled sx={{ color: 'text.disabled' }}><Fullscreen size={15} /></IconButton></span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
