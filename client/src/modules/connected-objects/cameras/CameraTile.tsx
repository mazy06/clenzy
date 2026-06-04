import { memo, useRef } from 'react';
import { Box, Typography, Chip, Tooltip, IconButton, alpha } from '@mui/material';
import { PlayArrow, StopCircle, FiberManualRecord, Fullscreen, WifiOff, PhotoCamera, Delete } from '../../../icons';
import type { CameraDto } from '../../../services/api/camerasApi';

const ACCENT = '#C97A7A'; // argile Baitly (couleur du type « caméra »)
const FEED_BG = '#10171C'; // surface « feed » très sombre, tintée bleu-gris (jamais #000)

interface CameraTileProps {
  camera: CameraDto;
  /** Lecture active — pilotée par le parent : une seule caméra lit à la fois. */
  active: boolean;
  /** Bascule lecture/arrêt de cette caméra. */
  onToggle: (id: number) => void;
  onDelete?: (id: number) => void;
  acting?: boolean;
}

/**
 * Tuile caméra — surface « feed » 16:9. Lecture WebRTC À LA DEMANDE (jamais d'autoplay)
 * via la passerelle media go2rtc (iframe stream.html).
 *
 * L'état de lecture est piloté par le parent : <b>une seule caméra lit à la fois</b>
 * (perf + scalabilité multi-tenant — chaque iframe = une connexion WebRTC + une source
 * go2rtc maintenue active côté serveur). Démonter l'iframe ferme la connexion et libère
 * la source. Mémoïsée : seules les tuiles dont une prop change re-rendent à chaque bascule.
 */
function CameraTile({ camera, active, onToggle, onDelete, acting = false }: CameraTileProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const { id, name, roomName, brand, online, recording } = camera;

  return (
    <Box
      sx={{
        borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider',
        bgcolor: 'background.paper', transition: 'border-color 200ms',
        '&:hover': { borderColor: alpha(ACCENT, 0.5) },
      }}
    >
      {/* ── Zone feed 16:9 ── */}
      <Box
        ref={feedRef}
        role={online ? 'button' : undefined}
        tabIndex={online ? 0 : undefined}
        onClick={() => online && onToggle(id)}
        onKeyDown={(e) => {
          if (online && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(id); }
        }}
        sx={{
          position: 'relative', aspectRatio: '16 / 9', bgcolor: FEED_BG,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: online ? 'pointer' : 'default', outline: 'none',
          '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${ACCENT}` },
          '&:hover .co-cam-play': { bgcolor: alpha(ACCENT, 0.9) },
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 38%, ${alpha('#2C3E48', 0.55)}, ${FEED_BG} 72%)` }} />

        {/* Pills haut */}
        <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
          {online ? (
            <Chip size="small" icon={<FiberManualRecord size={9} />} label="EN DIRECT"
              sx={{ height: 20, bgcolor: alpha('#4A9B8E', 0.92), color: '#fff', fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.06em',
                '& .MuiChip-icon': { color: '#fff', ml: '5px' } }} />
          ) : (
            <Chip size="small" label="Hors ligne" sx={{ height: 20, bgcolor: alpha('#9CA3AF', 0.85), color: '#fff', fontWeight: 600, fontSize: '0.6rem' }} />
          )}
          {recording && (
            <Tooltip title="Enregistrement" arrow>
              <Box component="span" sx={{ color: ACCENT, display: 'inline-flex' }}><FiberManualRecord size={12} /></Box>
            </Tooltip>
          )}
        </Box>

        {/* Centre : play à la demande / état flux / injoignable */}
        {online ? (
          active ? (
            camera.webrtcUrl ? (
              <Box
                component="iframe"
                title={name}
                src={camera.webrtcUrl}
                allow="autoplay; fullscreen; picture-in-picture"
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, zIndex: 2, bgcolor: '#000' }}
              />
            ) : (
              <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', px: 2 }}>
                <Typography sx={{ color: alpha('#fff', 0.7), fontSize: '0.66rem' }}>Flux indisponible — passerelle média non configurée.</Typography>
              </Box>
            )
          ) : (
            <Box className="co-cam-play"
              sx={{ position: 'relative', zIndex: 2, width: 46, height: 46, borderRadius: '50%', bgcolor: alpha('#fff', 0.14), color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 150ms' }}>
              <PlayArrow size={24} />
            </Box>
          )
        ) : (
          <Box sx={{ position: 'relative', zIndex: 2, color: alpha('#fff', 0.45), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <WifiOff size={22} />
            <Typography sx={{ fontSize: '0.62rem' }}>Caméra injoignable</Typography>
          </Box>
        )}

        {/* Overlay bas : nom + pièce */}
        <Box sx={{ position: 'absolute', left: 10, right: 10, bottom: 8, zIndex: 2 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2, textShadow: '0 1px 4px rgba(12,18,22,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </Typography>
          {roomName && (
            <Typography sx={{ color: alpha('#fff', 0.78), fontSize: '0.65rem', textShadow: '0 1px 3px rgba(12,18,22,0.7)' }}>{roomName}</Typography>
          )}
        </Box>
      </Box>

      {/* ── Footer : marque + actions ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.75 }}>
        <Box component="span" sx={{ color: ACCENT, display: 'inline-flex' }}><PhotoCamera size={14} strokeWidth={1.75} /></Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{brand || 'Caméra'}</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
          {/* Lecture/Arrêt — contrôle fiable au-dessus de l'iframe (le clic sur le feed est capté par l'iframe une fois lancée). */}
          {online && (
            <Tooltip title={active ? 'Arrêter la lecture' : 'Lancer la lecture'} arrow>
              <IconButton
                size="small"
                onClick={() => onToggle(id)}
                sx={{ color: active ? ACCENT : 'text.secondary', '&:hover': { color: ACCENT } }}
              >
                {active ? <StopCircle size={16} /> : <PlayArrow size={16} />}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={active ? 'Plein écran' : 'Lancez la lecture pour le plein écran'} arrow>
            <span>
              <IconButton
                size="small"
                disabled={!active || !camera.webrtcUrl}
                onClick={() => feedRef.current?.requestFullscreen?.()}
                sx={{ color: 'text.secondary', '&:hover': { color: ACCENT } }}
              >
                <Fullscreen size={15} />
              </IconButton>
            </span>
          </Tooltip>
          {onDelete && (
            <Tooltip title="Supprimer" arrow>
              <span><IconButton size="small" disabled={acting} onClick={() => onDelete(id)} sx={{ color: 'text.disabled', '&:hover': { color: ACCENT } }}><Delete size={15} strokeWidth={1.75} /></IconButton></span>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default memo(CameraTile);
