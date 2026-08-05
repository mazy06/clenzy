import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { PlayArrow, StopCircle, FiberManualRecord, Fullscreen, FullscreenExit, WifiOff, PhotoCamera, Delete } from '../../../icons';
import type { CameraDto } from '../../../services/api/camerasApi';

const ACCENT = '#C97A7A'; // argile Baitly (couleur du type « caméra »)
const FEED_BG = '#10171C'; // surface « feed » très sombre, tintée bleu-gris (jamais #000)
// Encre des overlays posés SUR le feed : la surface est sombre dans les deux
// thèmes, donc pas de jeton Baitly (qui, lui, s'inverse). Blanc TINTÉ vers le
// bleu de la marque — le blanc pur est proscrit.
const OVERLAY_INK = '#F4F7F9';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [posterOk, setPosterOk] = useState(true);
  const { id, name, roomName, brand, online, recording } = camera;

  // Poster : image fixe du flux (go2rtc frame.jpeg) affichée avant lecture, à la place de la
  // dalle noire. Null si hors ligne / en lecture / pas de snapshot / image en erreur.
  const poster = online && !active && posterOk ? camera.snapshotUrl : null;

  // Suit l'état plein écran de CE feed (le bouton doit basculer entrer/sortir, et l'overlay
  // de sortie n'apparaît qu'en plein écran).
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === feedRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement === feedRef.current) {
      void document.exitFullscreen?.();
    } else {
      void feedRef.current?.requestFullscreen?.();
    }
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border border-solid border-border bg-card transition-[border-color] duration-200 ease-out-quart motion-reduce:transition-none hover:border-input">
      {/* ── Zone feed 16:9 ── */}
      <div
        ref={feedRef}
        role={online ? 'button' : undefined}
        tabIndex={online ? 0 : undefined}
        onClick={() => online && onToggle(id)}
        onKeyDown={(e) => {
          if (online && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(id); }
        }}
        style={{ backgroundColor: FEED_BG }}
        className={cn(
          'group/feed relative aspect-[16/9] flex items-center justify-center outline-none',
          'focus-visible:shadow-[inset_0_0_0_2px_#C97A7A]',
          online ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        {/* Fond : poster (snapshot du flux) si dispo, sinon dégradé radial sombre. Le poster
            évite la dalle noire avant lecture (go2rtc tire l'image à la demande). */}
        {poster && (
          <img className="absolute inset-[0px] w-full h-full object-cover z-[0]" src={poster} alt="" loading="lazy" onError={() => setPosterOk(false)} />
        )}
        <div className="absolute inset-0 z-[1]" style={{ background: poster
            ? 'color-mix(in srgb, #0C1216 34%, transparent)'
            : `radial-gradient(circle at 50% 38%, color-mix(in srgb, #2C3E48 55%, transparent), ${FEED_BG} 72%)` }} />

        {/* Pills haut */}
        <div className="absolute top-[8px] start-[8px] end-[8px] flex items-center justify-between z-[2]">
          {online ? (
            <StatusChip tokens={{ color: OVERLAY_INK, bg: 'color-mix(in srgb, #4A9B8E 92%, transparent)' }} label="EN DIRECT" icon={<FiberManualRecord size={9} />} className="h-[20px] text-2xs tracking-[0.06em]" />
          ) : (
            <StatusChip tokens={{ color: OVERLAY_INK, bg: 'color-mix(in srgb, #9CA3AF 85%, transparent)' }} label="Hors ligne" className="h-[20px] text-2xs" />
          )}
          {recording && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex" style={{ color: ACCENT }}><FiberManualRecord size={12} /></span>
              </TooltipTrigger>
              <TooltipContent>Enregistrement</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Centre : play à la demande / état flux / injoignable */}
        {online ? (
          active ? (
            camera.webrtcUrl ? (
              <iframe
                title={name}
                src={camera.webrtcUrl}
                allow="autoplay; fullscreen; picture-in-picture"
                className="absolute inset-0 z-[2] h-full w-full border-0 bg-[#10171C]"
              />
            ) : (
              <div className="relative z-[2] text-center px-3">
                <p className="text-2xs text-[color-mix(in_srgb,#F4F7F9_70%,transparent)]">Flux indisponible — passerelle média non configurée.</p>
              </div>
            )
          ) : (
            // Le survol du feed teinte la pastille de lecture : `group/feed` porte
            // la regle que `&:hover .co-cam-play` assurait cote MUI.
            <div className="relative z-[2] w-[46px] h-[46px] rounded-full text-[#F4F7F9] flex items-center justify-center bg-[color-mix(in_srgb,#F4F7F9_14%,transparent)] transition-colors duration-150 ease-out-quart motion-reduce:transition-none group-hover/feed:bg-[color-mix(in_srgb,#C97A7A_90%,transparent)]">
              <PlayArrow size={24} />
            </div>
          )
        ) : (
          <div className="relative z-[2] flex flex-col items-center gap-[3px] text-[color-mix(in_srgb,#F4F7F9_45%,transparent)]">
            <WifiOff size={22} />
            <p className="text-2xs">Caméra injoignable</p>
          </div>
        )}

        {/* Bouton de sortie plein écran — overlay au-dessus de l'iframe (zIndex 4), visible
            uniquement en plein écran (le bouton du footer est alors hors du cadre). */}
        {isFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute top-3 end-3 z-[4] inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Quitter le plein écran"
                  onClick={(e) => { e.stopPropagation(); void document.exitFullscreen?.(); }}
                  className="rounded-full text-[#F4F7F9] bg-[color-mix(in_srgb,#0C1216_60%,transparent)] hover:bg-[color-mix(in_srgb,#C97A7A_92%,transparent)] hover:text-[#F4F7F9]"
                >
                  <FullscreenExit size={20} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Quitter le plein écran</TooltipContent>
          </Tooltip>
        )}

        {/* Overlay bas : nom + pièce */}
        <div className="absolute start-[10px] end-[10px] bottom-[8px] z-[2]">
          <p className="text-[#F4F7F9] font-bold text-[0.8rem] leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap" style={{ textShadow: '0 1px 4px rgba(12,18,22,0.7)' }}>
            {name}
          </p>
          {roomName && (
            <p className="text-2xs text-[color-mix(in_srgb,#F4F7F9_78%,transparent)]" style={{ textShadow: '0 1px 3px rgba(12,18,22,0.7)' }}>{roomName}</p>
          )}
        </div>
      </div>

      {/* ── Footer : marque + actions ── */}
      <div className="flex items-center gap-1 px-1.5 py-1">
        <span className="inline-flex" style={{ color: ACCENT }}><PhotoCamera size={14} strokeWidth={1.75} /></span>
        <span className="text-xs text-muted-foreground font-semibold">{brand || 'Caméra'}</span>
        <div className="ms-auto flex gap-0.5">
          {/* Lecture/Arrêt — contrôle fiable au-dessus de l'iframe (le clic sur le feed est capté par l'iframe une fois lancée). */}
          {online && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={active ? 'Arrêter la lecture' : 'Lancer la lecture'}
                    onClick={() => onToggle(id)}
                    className={cn('hover:text-[#C97A7A]', active ? 'text-[#C97A7A]' : 'text-muted-foreground')}
                  >
                    {active ? <StopCircle size={16} /> : <PlayArrow size={16} />}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{active ? 'Arrêter la lecture' : 'Lancer la lecture'}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Plein écran"
                  disabled={!active || !camera.webrtcUrl}
                  onClick={toggleFullscreen}
                  className="text-muted-foreground hover:text-[#C97A7A]"
                >
                  {isFullscreen ? <FullscreenExit size={15} /> : <Fullscreen size={15} />}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? 'Quitter le plein écran' : (active ? 'Plein écran' : 'Lancez la lecture pour le plein écran')}
            </TooltipContent>
          </Tooltip>
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer"
                    disabled={acting}
                    onClick={() => onDelete(id)}
                    className="text-faint hover:text-[#C97A7A]"
                  >
                    <Delete size={15} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Supprimer</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(CameraTile);
