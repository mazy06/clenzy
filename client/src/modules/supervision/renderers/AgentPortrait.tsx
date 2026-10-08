import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AGENT_META } from '../constants';
import { FLOW_CYCLE_MS } from '../core/dataFlow';
import { AGENT_PORTRAITS } from '../core/agentPortraitAssets';
import type { AgentId } from '../types';
import { AgentIcon } from './agentIcon';
import './agent-portrait.css';

/** Some browsers decode VP9 but discard its alpha; use the actual decoded pixel. */
function preservesTransparency(video: HTMLVideoElement): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(video, 0, 0, 1, 1, 0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3] < 16;
  } catch {
    return false;
  }
}

/** Mounted only for the aligned agent; native decoding replaces sprite jumps. */
function MovingPortrait({ agentId }: { agentId: AgentId }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mounted = useRef(true);
  const [format, setFormat] = useState<'video' | 'webp' | 'still'>('video');
  const [ready, setReady] = useState(false);
  const base = `/images/supervision-agents/${agentId}`;

  useEffect(() => {
    mounted.current = true;
    const video = videoRef.current;
    return () => {
      mounted.current = false;
      if (video && !video.paused) video.pause();
    };
  }, []);

  const fallback = () => {
    if (!mounted.current) return;
    setReady(false);
    setFormat('webp');
  };

  const start = (video: HTMLVideoElement) => {
    if (!preservesTransparency(video)) return fallback();
    // Same performance clock as the radial packet and onward tether. Sampling
    // at decode completion also accounts for slow networks and cached assets.
    video.currentTime = (performance.now() % FLOW_CYCLE_MS) / 1000;
    // Denied autoplay is not a codec failure: keep the still instead of fetching
    // a multi-megabyte fallback that would ignore the browser's motion policy.
    void video.play().catch(() => {
      if (mounted.current) { setReady(false); setFormat('still'); }
    });
  };

  return (
    <>
      {format === 'video' && (
        <video ref={videoRef} className="baitly-agent-portrait__motion" src={`${base}.webm?v=clean-2`}
          width={256} height={256} muted loop playsInline preload="auto" tabIndex={-1}
          disablePictureInPicture aria-hidden="true" data-ready={ready || undefined}
          onLoadedData={(event) => start(event.currentTarget)}
          onPlaying={() => setReady(true)} onError={fallback} />
      )}
      {format === 'webp' && (
        <img className="baitly-agent-portrait__motion" src={`${base}-animated.webp?v=clean-2`}
          width={256} height={256} alt="" draggable={false} data-ready={ready || undefined}
          onLoad={() => setReady(true)} onError={() => { setReady(false); setFormat('still'); }} />
      )}
    </>
  );
}

/** Decorative identity; the parent button provides the agent's accessible name. */
export function AgentPortrait({ agentId, receiving = false }: {
  agentId: AgentId;
  receiving?: boolean;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const src = AGENT_PORTRAITS[agentId];
  const [readySource, setReadySource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const ready = readySource === src;
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setReadySource(src);
  }, [src]);
  return (
    <span className="baitly-agent-portrait" data-receiving={receiving || undefined} aria-hidden="true">
      {!ready && <span className="baitly-agent-portrait__placeholder"><AgentIcon token={AGENT_META[agentId].icon} size={28} strokeWidth={1.6} /></span>}
      {failedSource !== src && <img ref={imageRef} className="baitly-agent-portrait__image" src={src} alt="" width={256} height={256}
        loading="eager" {...{ fetchpriority: receiving ? 'high' : 'auto' }} decoding="async" draggable={false}
        data-ready={ready || undefined} onLoad={() => setReadySource(src)} onError={() => { setFailedSource(src); setReadySource(null); }} />}
      {receiving && ready && <MovingPortrait key={agentId} agentId={agentId} />}
    </span>
  );
}
